import { error, fail, redirect } from '@sveltejs/kit';
import { getPost, postEditSchema, updatePost } from '$lib/server/posts';
import { formatValidationError, idSchema, parseFormData } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

function parsePostId(param: string): number {
	const id = idSchema.safeParse(param);
	if (!id.success) error(400, formatValidationError(id.error));
	return id.data;
}

export const load: PageServerLoad = ({ params }) => {
	const post = getPost(parsePostId(params.id));
	if (post === undefined) error(404, 'Post not found');
	return { post };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();
		const form = parseFormData(postEditSchema, formData);
		if (!form.success) {
			return fail(400, {
				message: formatValidationError(form.error),
				values: Object.fromEntries(
					['title', 'start', 'end', 'location', 'summary'].map((field) => [
						field,
						String(formData.get(field) ?? '')
					])
				)
			});
		}
		if (updatePost(parsePostId(params.id), form.data, new Date()) === undefined)
			error(404, 'Post not found');
		redirect(303, '/admin/posts');
	}
};
