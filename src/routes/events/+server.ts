import { json } from '@sveltejs/kit';
import { listPublicEvents, publicFeedQuerySchema } from '$lib/server/posts';
import { parseOrBadRequest } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** Public: the next page of the feed on `/`, for infinite scroll. */
export const GET: RequestHandler = ({ url }) => {
	const query = parseOrBadRequest(publicFeedQuerySchema, Object.fromEntries(url.searchParams));
	return json(listPublicEvents(query, new Date()));
};
