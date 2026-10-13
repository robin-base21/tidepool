import { beforeEach, describe, expect, it } from 'vitest';
import { count } from 'drizzle-orm';
import { db, openDatabase } from './db';
import { postImages } from './db/schema';
import { getPostImage } from './images';
import {
	createPostIfAbsent,
	deletePost,
	getDashboardStats,
	listPublicEvents,
	publicFeedQuerySchema,
	type NewPost,
	type PublicFeedPage
} from './posts';

const PNG_BYTES = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

function newPost(sourceId: string, sourceAccount: string, start: string): NewPost {
	return {
		source: 'instagram',
		source_account: sourceAccount,
		source_id: sourceId,
		source_url: `https://www.instagram.com/p/${sourceId}/`,
		source_posted_at: '2026-10-01T00:00:00Z',
		title: `Event ${sourceId}`,
		start,
		end: null,
		location: null,
		summary: null,
		image: { mime: 'image/png', data: PNG_BYTES }
	};
}

describe('deletePost', () => {
	beforeEach(() => openDatabase(':memory:'));

	it('deletes the post image with the post', () => {
		const now = new Date();
		const { post } = createPostIfAbsent(newPost('kept', 'a', '2026-10-20T00:00:00Z'), now);
		const { post: deleted } = createPostIfAbsent(newPost('gone', 'a', '2026-10-21T00:00:00Z'), now);
		expect(getPostImage(deleted.id)?.data).toEqual(PNG_BYTES);

		expect(deletePost(deleted.id)).toBe(true);

		expect(getPostImage(deleted.id)).toBeUndefined();
		expect(getPostImage(post.id)?.data).toEqual(PNG_BYTES);
		expect(db().select({ images: count() }).from(postImages).get()).toEqual({ images: 1 });
	});
});

describe('getDashboardStats', () => {
	const now = new Date('2026-10-13T00:00:00Z');

	beforeEach(() => {
		openDatabase(':memory:');
		createPostIfAbsent(newPost('past', 'a', '2026-10-12T23:00:00Z'), now);
		createPostIfAbsent(newPost('w0', 'a', '2026-10-13T09:00:00+09:00'), now); // 00:00Z, the first instant of week 0
		createPostIfAbsent(newPost('w0b', 'b', '2026-10-19T23:59:59Z'), now);
		createPostIfAbsent(newPost('w1', 'b', '2026-10-20T00:00:00Z'), now);
		createPostIfAbsent(newPost('w7', 'b', '2026-12-07T23:00:00Z'), now);
		createPostIfAbsent(newPost('w8', 'b', '2026-12-08T00:00:00Z'), now); // beyond the 8 weeks
	});

	it('counts total and upcoming posts', () => {
		const stats = getDashboardStats(now);
		expect(stats.totalPosts).toBe(6);
		expect(stats.upcomingPosts).toBe(5);
	});

	it('buckets upcoming events into 8 rolling weeks starting now', () => {
		expect(getDashboardStats(now).upcomingPerWeek).toEqual([
			{ weekStart: '2026-10-13T00:00:00.000Z', events: 2 },
			{ weekStart: '2026-10-20T00:00:00.000Z', events: 1 },
			{ weekStart: '2026-10-27T00:00:00.000Z', events: 0 },
			{ weekStart: '2026-11-03T00:00:00.000Z', events: 0 },
			{ weekStart: '2026-11-10T00:00:00.000Z', events: 0 },
			{ weekStart: '2026-11-17T00:00:00.000Z', events: 0 },
			{ weekStart: '2026-11-24T00:00:00.000Z', events: 0 },
			{ weekStart: '2026-12-01T00:00:00.000Z', events: 1 }
		]);
	});

	it('counts posts per source account, most first', () => {
		expect(getDashboardStats(now).postsPerSourceAccount).toEqual([
			{ sourceAccount: 'b', posts: 4 },
			{ sourceAccount: 'a', posts: 2 }
		]);
	});
});

describe('listPublicEvents', () => {
	const now = new Date('2026-10-13T12:00:00Z');

	function titles(page: PublicFeedPage): string[] {
		return page.events.map((event) => event.title);
	}

	function nextPage(page: PublicFeedPage): PublicFeedPage {
		return listPublicEvents(publicFeedQuerySchema.parse({ cursor: page.nextCursor }), now);
	}

	beforeEach(() => openDatabase(':memory:'));

	it('keeps events until they end, or until they start when they have no end', () => {
		const ended = newPost('ended', 'a', '2026-10-13T08:00:00Z');
		createPostIfAbsent({ ...ended, end: '2026-10-13T11:59:59Z' }, now);
		createPostIfAbsent(newPost('started', 'a', '2026-10-13T11:00:00Z'), now);
		const ongoing = newPost('ongoing', 'a', '2026-10-13T20:00:00+09:00'); // 11:00Z
		createPostIfAbsent({ ...ongoing, end: '2026-10-14T02:00:00+09:00' }, now);
		createPostIfAbsent(newPost('now', 'a', '2026-10-13T12:00:00Z'), now);
		createPostIfAbsent(newPost('later', 'a', '2026-10-20T00:00:00Z'), now);

		expect(titles(listPublicEvents({}, now))).toEqual([
			'Event ongoing',
			'Event now',
			'Event later'
		]);
	});

	it('pages 5 at a time, soonest first, until every event was shown once', () => {
		for (let day = 30; day >= 14; day--) {
			createPostIfAbsent(newPost(`d${day}`, 'a', `2026-10-${day}T00:00:00Z`), now);
		}

		const shown: string[] = [];
		let page = listPublicEvents({}, now);
		const pageSizes = [page.events.length];
		shown.push(...titles(page));
		while (page.nextCursor !== null) {
			page = nextPage(page);
			pageSizes.push(page.events.length);
			shown.push(...titles(page));
		}

		expect(pageSizes).toEqual([5, 5, 5, 2]);
		expect(shown).toEqual(Array.from({ length: 17 }, (_, index) => `Event d${index + 14}`));
	});

	it('exposes only the fields the feed shows', () => {
		createPostIfAbsent(newPost('x', 'base21.space', '2026-10-20T20:00:00+09:00'), now);
		expect(listPublicEvents({}, now).events).toEqual([
			{
				id: 1,
				title: 'Event x',
				start: '2026-10-20T20:00:00+09:00',
				end: null,
				location: null,
				summary: null,
				sourceUrl: 'https://www.instagram.com/p/x/',
				sourceAccount: 'base21.space',
				hasImage: true
			}
		]);
	});

	it('rejects an invalid cursor', () => {
		expect(publicFeedQuerySchema.safeParse({ cursor: 'nope' }).success).toBe(false);
	});
});
