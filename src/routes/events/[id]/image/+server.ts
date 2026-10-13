import { error } from '@sveltejs/kit';
import { getPostImage, imageResponse } from '$lib/server/images';
import { idSchema, parseOrBadRequest } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** Public: posters on the feed. Images never change after a post is created, so shared caches may keep them. */
export const GET: RequestHandler = ({ params }) => {
	const image = getPostImage(parseOrBadRequest(idSchema, params.id));
	if (image === undefined) error(404, 'Image not found');
	return imageResponse(image, 'public, max-age=86400');
};
