import { error, json } from '@sveltejs/kit';
import { authenticateApiKey } from '$lib/server/api-keys';
import { getPost, toPostResource } from '$lib/server/posts';
import { idSchema, parseOrBadRequest } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, params }) => {
	authenticateApiKey(request, 'read', new Date());
	const post = getPost(parseOrBadRequest(idSchema, params.id));
	if (post === undefined) error(404, 'Post not found');
	return json(toPostResource(post));
};
