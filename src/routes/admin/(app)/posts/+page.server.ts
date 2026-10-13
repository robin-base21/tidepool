import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { adminPostFilterSchema, deletePost, listPostsForAdmin } from '$lib/server/posts';
import { formatValidationError, idSchema, parseFormData } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const filter = adminPostFilterSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!filter.success) error(400, formatValidationError(filter.error));
	return { filter: filter.data, posts: listPostsForAdmin(filter.data, new Date()) };
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const form = parseFormData(z.object({ id: idSchema }), await request.formData());
		if (!form.success) return fail(400, { message: formatValidationError(form.error) });
		if (!deletePost(form.data.id)) return fail(404, { message: 'Post not found' });
		return { deletedPostId: form.data.id };
	}
};
