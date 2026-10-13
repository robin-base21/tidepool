import { beforeEach, describe, expect, it } from 'vitest';
import { count } from 'drizzle-orm';
import { db, openDatabase } from './db';
import { postImages } from './db/schema';
import { getPostImage } from './images';
import { createPostIfAbsent, deletePost, getDashboardStats, type NewPost } from './posts';

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
