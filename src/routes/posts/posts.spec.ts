import { isHttpError, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApiKey } from '$lib/server/api-keys';
import { loadConfig } from '$lib/server/config';
import { openDatabase } from '$lib/server/db';
import { deletePost, updatePost, type PostResource } from '$lib/server/posts';
import { SESSION_COOKIE, startSession } from '$lib/server/session';
import { GET as getPosts, POST as postPosts } from './+server';
import { GET as getPostById } from './[id]/+server';
import { GET as getPostImage } from './[id]/image/+server';
import { GET as getPublicEvents } from '../events/+server';
import { GET as getPublicImage } from '../events/[id]/image/+server';
import { POST as postSeen } from '../seen/+server';
import { POST as postSeenCheck } from '../seen/check/+server';

const PNG_BYTES = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG_DATA_URL = `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}`;

async function call<Event extends RequestEvent>(
	handler: (event: Event) => Response | Promise<Response>,
	options: {
		method: 'GET' | 'POST';
		path: string;
		key?: string;
		body?: string;
		params?: Record<string, string>;
		cookies?: Record<string, string>;
	}
): Promise<{ status: number; body: any }> {
	const response = await respond(handler, options);
	if (response instanceof Response) return { status: response.status, body: await response.json() };
	return response;
}

/** Runs a handler like SvelteKit would: a returned Response, or a thrown HTTP error as { status, body }. */
async function respond<Event extends RequestEvent>(
	handler: (event: Event) => Response | Promise<Response>,
	options: {
		method: 'GET' | 'POST';
		path: string;
		key?: string;
		body?: string;
		params?: Record<string, string>;
		cookies?: Record<string, string>;
	}
): Promise<Response | { status: number; body: App.Error }> {
	const url = new URL(options.path, 'http://tidepool.test');
	const headers = new Headers({ 'content-type': 'application/json' });
	if (options.key !== undefined) headers.set('authorization', `Bearer ${options.key}`);
	const request = new Request(url, { method: options.method, headers, body: options.body });
	const cookieValues = options.cookies ?? {};
	const cookies = { get: (name: string) => cookieValues[name] } as Cookies;
	const event = { request, url, cookies, params: options.params ?? {} } as unknown as Event;
	try {
		return await handler(event);
	} catch (thrown) {
		if (isHttpError(thrown)) return { status: thrown.status, body: thrown.body };
		throw thrown;
	}
}

function postBody(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		source: 'instagram',
		source_account: 'base21.space',
		source_id: 'DYD1txkPDsA',
		source_url: 'https://www.instagram.com/p/DYD1txkPDsA/',
		source_posted_at: '2026-10-07T03:00:00+00:00',
		title: 'Night market',
		start: '2026-10-10T20:00:00+09:00',
		end: null,
		location: 'Base21',
		summary: 'Food and music',
		image: PNG_DATA_URL,
		...overrides
	});
}

let readKey: string;
let writeKey: string;

beforeEach(() => {
	loadConfig({
		ADMIN_PASSWORD_HASH: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA',
		SESSION_SECRET: 'x'.repeat(32),
		ORIGIN: 'https://tidepool.test',
		DATABASE_PATH: ':memory:'
	});
	openDatabase(':memory:');
	const now = new Date();
	readKey = createApiKey({ name: 'scraper', scope: 'read' }, now).key;
	writeKey = createApiKey({ name: 'n8n', scope: 'write' }, now).key;
});

describe('API key authentication', () => {
	it('rejects a missing Authorization header with 401', async () => {
		const response = await call(postPosts, { method: 'POST', path: '/posts', body: postBody() });
		expect(response).toEqual({ status: 401, body: { message: 'Missing Authorization header' } });
	});

	it('rejects an unknown key with 401', async () => {
		const response = await call(getPosts, {
			method: 'GET',
			path: '/posts',
			key: 'tp_not-a-real-key'
		});
		expect(response).toEqual({ status: 401, body: { message: 'Invalid API key' } });
	});

	it('rejects a read key on POST with 403', async () => {
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: readKey,
			body: postBody()
		});
		expect(response.status).toBe(403);
		expect(response.body.message).toContain('write scope is required');
	});

	it('lets a write key read', async () => {
		const response = await call(getPosts, { method: 'GET', path: '/posts', key: writeKey });
		expect(response).toEqual({ status: 200, body: { posts: [], next_cursor: null } });
	});
});

describe('POST /posts', () => {
	it('creates a post with 201 and returns every source field', async () => {
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody()
		});
		expect(response.status).toBe(201);
		expect(response.body).toMatchObject({
			source: 'instagram',
			source_account: 'base21.space',
			source_id: 'DYD1txkPDsA',
			source_url: 'https://www.instagram.com/p/DYD1txkPDsA/',
			source_posted_at: '2026-10-07T03:00:00+00:00',
			start: '2026-10-10T20:00:00+09:00'
		});
	});

	it('returns the stored post unchanged with 200 when re-sent, keeping admin edits', async () => {
		const created = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody()
		});
		updatePost(
			created.body.id,
			{
				title: 'Edited by admin',
				start: '2026-10-10T20:00:00+09:00',
				end: null,
				location: 'Base21',
				summary: null
			},
			new Date()
		);

		const resent = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ title: 'Title from n8n' })
		});

		expect(resent.status).toBe(200);
		expect(resent.body.id).toBe(created.body.id);
		expect(resent.body.title).toBe('Edited by admin');
		expect(resent.body.summary).toBeNull();
	});
});

describe('validation', () => {
	it('rejects malformed JSON with 400', async () => {
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: '{"title":'
		});
		expect(response).toEqual({ status: 400, body: { message: 'Request body must be valid JSON' } });
	});

	it('names each invalid field', async () => {
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ title: '', start: '2026-10-10 20:00', source_url: 'not a url' })
		});
		expect(response.status).toBe(400);
		expect(response.body.message).toContain('title: must not be empty');
		expect(response.body.message).toContain('start: must be an ISO 8601 datetime');
		expect(response.body.message).toContain('source_url: must be an http(s) URL');
	});

	it('rejects a missing required field and unknown fields', async () => {
		const body = JSON.parse(postBody({ colour: 'blue' }));
		delete body.end;
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: JSON.stringify(body)
		});
		expect(response.status).toBe(400);
		expect(response.body.message).toContain('end: is required');
		expect(response.body.message).toMatch(/colour/);
	});

	it('rejects an end before the start', async () => {
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ end: '2026-10-10T10:00:00+09:00' })
		});
		expect(response).toEqual({ status: 400, body: { message: 'end: must not be before start' } });
	});

	it('rejects out-of-range limits and bad cursors on GET', async () => {
		const limit = await call(getPosts, { method: 'GET', path: '/posts?limit=500', key: readKey });
		expect(limit).toEqual({ status: 400, body: { message: 'limit: must be between 1 and 200' } });

		const cursor = await call(getPosts, {
			method: 'GET',
			path: '/posts?cursor=garbage',
			key: readKey
		});
		expect(cursor).toEqual({ status: 400, body: { message: 'cursor: is not a valid cursor' } });
	});

	it('rejects a non-numeric post id', async () => {
		const response = await call(getPostById, {
			method: 'GET',
			path: '/posts/abc',
			key: readKey,
			params: { id: 'abc' }
		});
		expect(response).toEqual({ status: 400, body: { message: 'id must be a positive integer' } });
	});
});

describe('GET /posts filters and pagination', () => {
	async function createPost(
		sourceId: string,
		overrides: Record<string, unknown>
	): Promise<PostResource> {
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ source_id: sourceId, ...overrides })
		});
		return response.body;
	}

	async function listTitles(
		query: string
	): Promise<{ titles: string[]; next_cursor: string | null }> {
		const response = await call(getPosts, { method: 'GET', path: `/posts?${query}`, key: readKey });
		expect(response.status).toBe(200);
		return {
			titles: response.body.posts.map((post: PostResource) => post.title),
			next_cursor: response.body.next_cursor
		};
	}

	beforeEach(async () => {
		// Offsets differ on purpose: chronological order is not string order.
		await createPost('c', { title: 'C', start: '2026-10-12T09:00:00Z' });
		await createPost('a', { title: 'A', start: '2026-10-10T20:00:00+09:00' }); // 11:00Z
		await createPost('b', { title: 'B', start: '2026-10-10T12:00:00+00:00' });
		await createPost('d', {
			title: 'D',
			start: '2026-10-20T10:00:00+02:00',
			source_account: 'other.account'
		});
	});

	it('orders by the instant of start, then id', async () => {
		expect((await listTitles('')).titles).toEqual(['A', 'B', 'C', 'D']);
	});

	it('filters start_from (inclusive) and start_to (exclusive) across offsets', async () => {
		const { titles } = await listTitles(
			new URLSearchParams({
				start_from: '2026-10-10T21:00:00+09:00',
				start_to: '2026-10-12T09:00:00Z'
			}).toString()
		);
		expect(titles).toEqual(['B']);
	});

	it('filters by source_account', async () => {
		expect((await listTitles('source_account=other.account')).titles).toEqual(['D']);
	});

	it('filters by updated_since', async () => {
		const before = new Date(Date.now() - 60_000).toISOString();
		const after = new Date(Date.now() + 60_000).toISOString();
		expect(
			(await listTitles(new URLSearchParams({ updated_since: before }).toString())).titles
		).toHaveLength(4);
		expect(
			(await listTitles(new URLSearchParams({ updated_since: after }).toString())).titles
		).toEqual([]);
	});

	it('pages through every post exactly once with the cursor', async () => {
		const first = await listTitles('limit=3');
		expect(first.titles).toEqual(['A', 'B', 'C']);
		expect(first.next_cursor).not.toBeNull();

		const second = await listTitles(`limit=3&cursor=${first.next_cursor}`);
		expect(second).toEqual({ titles: ['D'], next_cursor: null });
	});

	it('keeps paginating correctly when posts share a start', async () => {
		await createPost('e', { title: 'E', start: '2026-10-10T11:00:00Z' }); // same instant as A
		const pages: string[] = [];
		let cursor: string | null = null;
		do {
			const page = await listTitles(cursor === null ? 'limit=1' : `limit=1&cursor=${cursor}`);
			pages.push(...page.titles);
			cursor = page.next_cursor;
		} while (cursor !== null);
		expect(pages).toEqual(['A', 'E', 'B', 'C', 'D']);
	});

	it('returns a single post by id with source fields', async () => {
		const created = await createPost('f', { title: 'F' });
		const response = await call(getPostById, {
			method: 'GET',
			path: `/posts/${created.id}`,
			key: readKey,
			params: { id: String(created.id) }
		});
		expect(response.status).toBe(200);
		expect(response.body).toEqual(created);

		const missing = await call(getPostById, {
			method: 'GET',
			path: '/posts/9999',
			key: readKey,
			params: { id: '9999' }
		});
		expect(missing).toEqual({ status: 404, body: { message: 'Post not found' } });
	});
});

describe('images', () => {
	async function postWithImage(image: unknown, sourceId = 'img') {
		return call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ source_id: sourceId, image })
		});
	}

	function adminSessionCookie(): Record<string, string> {
		let value = '';
		startSession(
			{ set: (_name: string, cookie: string) => (value = cookie) } as unknown as Cookies,
			new Date()
		);
		return { [SESSION_COOKIE]: value };
	}

	it('rejects a missing image', async () => {
		const body = JSON.parse(postBody());
		delete body.image;
		const response = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: JSON.stringify(body)
		});
		expect(response).toEqual({ status: 400, body: { message: 'image: is required' } });
	});

	it('rejects an unsupported MIME type', async () => {
		const response = await postWithImage(`data:image/gif;base64,${PNG_BYTES.toString('base64')}`);
		expect(response).toEqual({
			status: 400,
			body: { message: 'image: must be image/jpeg, image/png, image/webp (got image/gif)' }
		});
	});

	it('rejects strings that are not base64 data URLs', async () => {
		expect((await postWithImage('https://example.com/a.png')).body.message).toBe(
			'image: must be a base64 data URL, e.g. data:image/jpeg;base64,...'
		);
		expect((await postWithImage('data:image/png;base64,not base64!')).body.message).toBe(
			'image: is not valid base64'
		);
	});

	it('rejects content that does not match the declared type', async () => {
		const response = await postWithImage(`data:image/png;base64,${JPEG_BYTES.toString('base64')}`);
		expect(response).toEqual({
			status: 400,
			body: { message: 'image: content is not a valid image/png file' }
		});
	});

	it('rejects an image over 5 MB decoded', async () => {
		const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
		const response = await postWithImage(`data:image/png;base64,${oversized.toString('base64')}`);
		expect(response.status).toBe(400);
		expect(response.body.message).toBe(
			`image: must be at most 5 MB (5,242,880 bytes) decoded; got ${oversized.length.toLocaleString('en')} bytes`
		);
	});

	it('accepts an image of exactly 5 MB', async () => {
		const maximal = Buffer.concat([PNG_BYTES, Buffer.alloc(5 * 1024 * 1024 - PNG_BYTES.length)]);
		const response = await postWithImage(`data:image/png;base64,${maximal.toString('base64')}`);
		expect(response.status).toBe(201);
	});

	it('returns an absolute image_url built from ORIGIN', async () => {
		const created = await postWithImage(PNG_DATA_URL);
		expect(created.body.image_url).toBe(`https://tidepool.test/posts/${created.body.id}/image`);
	});

	it('keeps the stored image when an existing post is re-sent', async () => {
		const created = await postWithImage(PNG_DATA_URL, 'resend');
		const resent = await postWithImage(JPEG_DATA_URL, 'resend');
		expect(resent.status).toBe(200);

		const image = await respond(getPostImage, {
			method: 'GET',
			path: `/posts/${created.body.id}/image`,
			key: readKey,
			params: { id: String(created.body.id) }
		});
		if (!(image instanceof Response)) throw new Error(`Expected an image, got ${image.status}`);
		expect(image.headers.get('content-type')).toBe('image/png');
		expect(Buffer.from(await image.arrayBuffer())).toEqual(PNG_BYTES);
	});

	describe('GET /posts/:id/image', () => {
		let postId: string;

		beforeEach(async () => {
			postId = String((await postWithImage(PNG_DATA_URL)).body.id);
		});

		it('requires a key or an admin session', async () => {
			const response = await respond(getPostImage, {
				method: 'GET',
				path: `/posts/${postId}/image`,
				params: { id: postId }
			});
			expect(response).toEqual({
				status: 401,
				body: { message: 'Requires an API key with read scope or an admin session' }
			});
		});

		it('rejects an invalid key even with a session', async () => {
			const response = await respond(getPostImage, {
				method: 'GET',
				path: `/posts/${postId}/image`,
				key: 'tp_not-a-real-key',
				cookies: adminSessionCookie(),
				params: { id: postId }
			});
			expect(response).toEqual({ status: 401, body: { message: 'Invalid API key' } });
		});

		it('serves the raw image to a read key', async () => {
			const response = await respond(getPostImage, {
				method: 'GET',
				path: `/posts/${postId}/image`,
				key: readKey,
				params: { id: postId }
			});
			if (!(response instanceof Response))
				throw new Error(`Expected an image, got ${response.status}`);
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('image/png');
			expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
			expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG_BYTES);
		});

		it('serves the image to an admin session', async () => {
			const response = await respond(getPostImage, {
				method: 'GET',
				path: `/posts/${postId}/image`,
				cookies: adminSessionCookie(),
				params: { id: postId }
			});
			expect(response instanceof Response && response.status).toBe(200);
		});

		it('returns 404 for a post without an image', async () => {
			const response = await respond(getPostImage, {
				method: 'GET',
				path: '/posts/9999/image',
				key: readKey,
				params: { id: '9999' }
			});
			expect(response).toEqual({ status: 404, body: { message: 'Image not found' } });
		});
	});
});

describe('public feed', () => {
	it('lists upcoming events without a key', async () => {
		await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ start: '2999-01-01T00:00:00Z' })
		});
		const response = await call(getPublicEvents, { method: 'GET', path: '/events' });
		expect(response.status).toBe(200);
		expect(response.body.events.map((event: { title: string }) => event.title)).toEqual([
			'Night market'
		]);
		expect(response.body.nextCursor).toBeNull();
	});

	it('rejects a bad cursor with 400', async () => {
		const response = await call(getPublicEvents, { method: 'GET', path: '/events?cursor=nope' });
		expect(response).toEqual({ status: 400, body: { message: 'cursor: is not a valid cursor' } });
	});

	it('serves images without a key, cacheable publicly', async () => {
		const created = await call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody()
		});
		const response = await respond(getPublicImage, {
			method: 'GET',
			path: `/events/${created.body.id}/image`,
			params: { id: String(created.body.id) }
		});
		if (!(response instanceof Response))
			throw new Error(`Expected a Response, got ${response.status}`);
		expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
		expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG_BYTES);
	});
});

describe('seen tracking', () => {
	async function unseenIds(sourceIds: string[], source = 'instagram'): Promise<string[]> {
		const response = await call(postSeenCheck, {
			method: 'POST',
			path: '/seen/check',
			key: readKey,
			body: JSON.stringify({ source, source_ids: sourceIds })
		});
		expect(response.status).toBe(200);
		return response.body.unseen_ids;
	}

	async function markNotEvent(sourceId: string) {
		return call(postSeen, {
			method: 'POST',
			path: '/seen',
			key: writeKey,
			body: JSON.stringify({ source: 'instagram', source_id: sourceId, outcome: 'not_event' })
		});
	}

	async function createPost(sourceId: string) {
		return call(postPosts, {
			method: 'POST',
			path: '/posts',
			key: writeKey,
			body: postBody({ source_id: sourceId })
		});
	}

	it('returns only unseen ids, in input order', async () => {
		await createPost('event1');
		expect(await markNotEvent('meme1')).toEqual({ status: 200, body: { seen: true } });

		expect(await unseenIds(['new2', 'event1', 'new1', 'meme1', 'new3'])).toEqual([
			'new2',
			'new1',
			'new3'
		]);
		expect(await unseenIds(['event1', 'meme1'], 'tiktok')).toEqual(['event1', 'meme1']);
	});

	it('marks a post seen when POST /posts creates it', async () => {
		expect(await unseenIds(['DYD1txkPDsA'])).toEqual(['DYD1txkPDsA']);
		expect((await createPost('DYD1txkPDsA')).status).toBe(201);
		expect(await unseenIds(['DYD1txkPDsA'])).toEqual([]);
	});

	it('turns an earlier not_event into an event when the post is created after all', async () => {
		await markNotEvent('changed-mind');
		expect((await createPost('changed-mind')).status).toBe(201);
		expect(await unseenIds(['changed-mind'])).toEqual([]);
	});

	it('accepts marking the same post twice', async () => {
		await markNotEvent('meme');
		expect(await markNotEvent('meme')).toEqual({ status: 200, body: { seen: true } });
	});

	it('rejects outcome event on POST /seen', async () => {
		const response = await call(postSeen, {
			method: 'POST',
			path: '/seen',
			key: writeKey,
			body: JSON.stringify({ source: 'instagram', source_id: 'x', outcome: 'event' })
		});
		expect(response).toEqual({
			status: 400,
			body: { message: 'outcome: must be "not_event"; events are marked seen by POST /posts' }
		});
		expect(await unseenIds(['x'])).toEqual(['x']);
	});

	it('keeps a deleted post seen', async () => {
		const created = await createPost('false-positive');
		expect(deletePost(created.body.id)).toBe(true);
		expect(await unseenIds(['false-positive'])).toEqual([]);
	});

	it('needs a write key to mark and a read key to check', async () => {
		const marked = await call(postSeen, {
			method: 'POST',
			path: '/seen',
			key: readKey,
			body: JSON.stringify({ source: 'instagram', source_id: 'x', outcome: 'not_event' })
		});
		expect(marked.status).toBe(403);
		const checked = await call(postSeenCheck, {
			method: 'POST',
			path: '/seen/check',
			body: JSON.stringify({ source: 'instagram', source_ids: ['x'] })
		});
		expect(checked.status).toBe(401);
	});

	it('accepts 1 to 100 ids', async () => {
		const tooMany = Array.from({ length: 101 }, (_, index) => `id${index}`);
		for (const sourceIds of [[], tooMany]) {
			const response = await call(postSeenCheck, {
				method: 'POST',
				path: '/seen/check',
				key: readKey,
				body: JSON.stringify({ source: 'instagram', source_ids: sourceIds })
			});
			expect(response).toEqual({
				status: 400,
				body: { message: 'source_ids: must contain 1 to 100 ids' }
			});
		}
		expect(await unseenIds(tooMany.slice(0, 100))).toHaveLength(100);
	});
});
