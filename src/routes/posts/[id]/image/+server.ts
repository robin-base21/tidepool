import { error, type Cookies } from '@sveltejs/kit';
import { authenticateApiKey } from '$lib/server/api-keys';
import { getPostImage, imageResponse } from '$lib/server/images';
import { isValidSession, SESSION_COOKIE } from '$lib/server/session';
import { idSchema, parseOrBadRequest } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** A bearer key is checked when one is sent; otherwise an admin session (used by the admin UI) is accepted. */
function authorizeImageRequest(request: Request, cookies: Cookies, now: Date): void {
	if (request.headers.has('authorization')) {
		authenticateApiKey(request, 'read', now);
		return;
	}
	if (!isValidSession(cookies.get(SESSION_COOKIE), now)) {
		error(401, 'Requires an API key with read scope or an admin session');
	}
}

export const GET: RequestHandler = ({ request, cookies, params }) => {
	authorizeImageRequest(request, cookies, new Date());
	const image = getPostImage(parseOrBadRequest(idSchema, params.id));
	if (image === undefined) error(404, 'Image not found');
	return imageResponse(image, 'private, max-age=86400');
};
