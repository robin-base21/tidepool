import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { createApiKey, deleteApiKey, listApiKeys, newApiKeySchema } from '$lib/server/api-keys';
import { formatValidationError, idSchema, parseFormData } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {
		apiKeys: listApiKeys().map(({ keyHash: _keyHash, ...apiKey }) => apiKey)
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = parseFormData(newApiKeySchema, await request.formData());
		if (!form.success) return fail(400, { message: formatValidationError(form.error) });
		const { apiKey, key } = createApiKey(form.data, new Date());
		return { createdKey: { name: apiKey.name, scope: apiKey.scope, key } };
	},

	delete: async ({ request }) => {
		const form = parseFormData(z.object({ id: idSchema }), await request.formData());
		if (!form.success) return fail(400, { message: formatValidationError(form.error) });
		if (!deleteApiKey(form.data.id)) return fail(404, { message: 'API key not found' });
		return { deletedKeyId: form.data.id };
	}
};
