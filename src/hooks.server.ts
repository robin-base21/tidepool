import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { loadConfig } from '$lib/server/config';
import { openDatabase } from '$lib/server/db';
import { isValidSession, SESSION_COOKIE } from '$lib/server/session';

export const init: ServerInit = () => {
	const config = loadConfig(env);
	openDatabase(config.databasePath);
};

function requiresAdminSession(pathname: string): boolean {
	const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
	return isAdminArea && pathname !== '/admin/login';
}

export const handle: Handle = async ({ event, resolve }) => {
	if (
		requiresAdminSession(event.url.pathname) &&
		!isValidSession(event.cookies.get(SESSION_COOKIE), new Date())
	) {
		redirect(303, '/admin/login');
	}
	return resolve(event);
};
