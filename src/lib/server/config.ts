import { z } from 'zod';

function requiredString(name: string) {
	return z.string({ error: `${name} is required` }).min(1, `${name} is required`);
}

const environmentSchema = z.object({
	ADMIN_PASSWORD_HASH: requiredString('ADMIN_PASSWORD_HASH').startsWith(
		'$argon2id$',
		'ADMIN_PASSWORD_HASH must be an argon2id hash (generate one with `npm run hash-password`)'
	),
	SESSION_SECRET: requiredString('SESSION_SECRET').min(
		32,
		'SESSION_SECRET must be at least 32 characters'
	),
	ORIGIN: requiredString('ORIGIN').pipe(
		z.url('ORIGIN must be a URL such as https://tidepool.example.com')
	),
	DATABASE_PATH: requiredString('DATABASE_PATH')
});

export type Config = {
	adminPasswordHash: string;
	/** Public origin, normalised the same way adapter-node normalises ORIGIN. */
	origin: string;
	sessionSecret: string;
	databasePath: string;
};

let loadedConfig: Config | undefined;

export function loadConfig(environment: Record<string, string | undefined>): Config {
	const result = environmentSchema.safeParse(environment);
	if (!result.success) {
		const problems = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
		throw new Error(`Invalid environment configuration:\n${problems}`);
	}
	loadedConfig = {
		adminPasswordHash: result.data.ADMIN_PASSWORD_HASH,
		origin: new URL(result.data.ORIGIN).origin,
		sessionSecret: result.data.SESSION_SECRET,
		databasePath: result.data.DATABASE_PATH
	};
	return loadedConfig;
}

export function getConfig(): Config {
	if (!loadedConfig) throw new Error('Config accessed before loadConfig() ran in the init hook');
	return loadedConfig;
}
