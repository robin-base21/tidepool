import { json } from '@sveltejs/kit';
import { authenticateApiKey } from '$lib/server/api-keys';
import { markNotEventSeen, markSeenSchema } from '$lib/server/seen';
import { parseOrBadRequest, readJsonBody } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const now = new Date();
	authenticateApiKey(request, 'write', now);
	markNotEventSeen(parseOrBadRequest(markSeenSchema, await readJsonBody(request)), now);
	return json({ seen: true });
};
