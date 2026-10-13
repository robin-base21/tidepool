import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { getConfig } from './config';

export const SESSION_COOKIE = 'tidepool_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
	return createHmac('sha256', getConfig().sessionSecret).update(payload).digest('base64url');
}

/** Session value is `<expiresAtMs>.<hmac>`; the signature makes it unforgeable without SESSION_SECRET. */
export function startSession(cookies: Cookies, now: Date): void {
	const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
	const payload = String(expiresAt.getTime());
	cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function endSession(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function isValidSession(value: string | undefined, now: Date): boolean {
	if (value === undefined) return false;
	const [payload, signature] = value.split('.');
	if (payload === undefined || signature === undefined || !/^\d+$/.test(payload)) return false;

	const expected = Buffer.from(sign(payload));
	const actual = Buffer.from(signature);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

	return Number(payload) > now.getTime();
}
