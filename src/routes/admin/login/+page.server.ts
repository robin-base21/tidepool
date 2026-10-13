import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import { z } from 'zod';
import { getConfig } from '$lib/server/config';
import {
	clearFailedLogins,
	loginBlockedForMinutes,
	recordFailedLogin
} from '$lib/server/login-rate-limit';
import { endSession, isValidSession, SESSION_COOKIE, startSession } from '$lib/server/session';
import { formatValidationError, parseFormData } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

const loginFormSchema = z.object({
	password: z.string({ error: 'Password is required' }).min(1, 'Password is required')
});

export const load: PageServerLoad = ({ cookies }) => {
	if (isValidSession(cookies.get(SESSION_COOKIE), new Date())) redirect(303, '/admin');
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress }) => {
		const now = new Date();
		const ip = getClientAddress();

		const blockedMinutes = loginBlockedForMinutes(ip, now);
		if (blockedMinutes !== null) {
			return fail(429, {
				message: `Too many failed attempts. Try again in ${blockedMinutes} minute${blockedMinutes === 1 ? '' : 's'}.`
			});
		}

		const form = parseFormData(loginFormSchema, await request.formData());
		if (!form.success) return fail(400, { message: formatValidationError(form.error) });

		if (!(await verify(getConfig().adminPasswordHash, form.data.password))) {
			recordFailedLogin(ip, now);
			return fail(401, { message: 'Incorrect password' });
		}

		clearFailedLogins(ip);
		startSession(cookies, now);
		redirect(303, '/admin');
	},

	logout: ({ cookies }) => {
		endSession(cookies);
		redirect(303, '/admin/login');
	}
};
