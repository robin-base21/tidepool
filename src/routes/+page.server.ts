import { listPublicEvents, publicFeedQuerySchema } from '$lib/server/posts';
import { parseOrBadRequest } from '$lib/server/validation';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const query = parseOrBadRequest(publicFeedQuerySchema, Object.fromEntries(url.searchParams));
	return listPublicEvents(query, new Date());
};
