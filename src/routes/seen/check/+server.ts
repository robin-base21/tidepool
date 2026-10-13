import { json } from '@sveltejs/kit';
import { authenticateApiKey } from '$lib/server/api-keys';
import { findUnseenIds, seenCheckSchema } from '$lib/server/seen';
import { parseOrBadRequest, readJsonBody } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	authenticateApiKey(request, 'read', new Date());
	const check = parseOrBadRequest(seenCheckSchema, await readJsonBody(request));
	return json({ unseen_ids: findUnseenIds(check) });
};
