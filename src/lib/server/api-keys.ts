import { createHash, randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { apiKeys, type ApiKey, type ApiKeyScope } from './db/schema';

export const newApiKeySchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.max(100, 'Name must be at most 100 characters'),
	scope: z.enum(['read', 'write'], { error: 'Scope must be read or write' })
});

export function hashApiKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export function createApiKey(
	input: z.output<typeof newApiKeySchema>,
	now: Date
): { apiKey: ApiKey; key: string } {
	const key = `tp_${randomBytes(32).toString('base64url')}`;
	const apiKey = db()
		.insert(apiKeys)
		.values({
			name: input.name,
			scope: input.scope,
			keyHash: hashApiKey(key),
			keyPrefix: key.slice(0, 8),
			createdAt: now.toISOString()
		})
		.returning()
		.get();
	return { apiKey, key };
}

export function listApiKeys(): ApiKey[] {
	return db().select().from(apiKeys).orderBy(desc(apiKeys.createdAt), desc(apiKeys.id)).all();
}

export function deleteApiKey(id: number): boolean {
	return db().delete(apiKeys).where(eq(apiKeys.id, id)).run().changes > 0;
}

function grantsScope(granted: ApiKeyScope, required: ApiKeyScope): boolean {
	return granted === 'write' || required === 'read';
}

/** Validates the request's bearer key, records its use, and throws 401/403 unless it grants `requiredScope`. */
export function authenticateApiKey(
	request: Request,
	requiredScope: ApiKeyScope,
	now: Date
): ApiKey {
	const header = request.headers.get('authorization');
	if (header === null) error(401, 'Missing Authorization header');

	const match = /^Bearer (\S+)$/.exec(header);
	if (match === null) error(401, 'Authorization header must be "Bearer <key>"');

	const apiKey = db()
		.update(apiKeys)
		.set({ lastUsedAt: now.toISOString() })
		.where(eq(apiKeys.keyHash, hashApiKey(match[1])))
		.returning()
		.get();
	if (apiKey === undefined) error(401, 'Invalid API key');

	if (!grantsScope(apiKey.scope, requiredScope)) {
		error(403, `This API key has ${apiKey.scope} scope; ${requiredScope} scope is required`);
	}
	return apiKey;
}
