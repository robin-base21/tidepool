import { json } from '@sveltejs/kit';
import { authenticateApiKey } from '$lib/server/api-keys';
import {
	createPostIfAbsent,
	listPostsForApi,
	listPostsQuerySchema,
	newPostSchema,
	toPostResource
} from '$lib/server/posts';
import { parseOrBadRequest, readJsonBody } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const now = new Date();
	authenticateApiKey(request, 'write', now);
	const input = parseOrBadRequest(newPostSchema, await readJsonBody(request));
	const { post, created } = createPostIfAbsent(input, now);
	return json(toPostResource(post), { status: created ? 201 : 200 });
};

export const GET: RequestHandler = ({ request, url }) => {
	authenticateApiKey(request, 'read', new Date());
	const query = parseOrBadRequest(listPostsQuerySchema, Object.fromEntries(url.searchParams));
	return json(listPostsForApi(query));
};
