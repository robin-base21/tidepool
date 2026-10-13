import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type TidepoolDatabase = BetterSQLite3Database<typeof schema>;

let openedDatabase: TidepoolDatabase | undefined;

export function openDatabase(path: string): TidepoolDatabase {
	const client = new Database(path);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	const database = drizzle(client, { schema });
	migrate(database, { migrationsFolder: 'drizzle' });
	openedDatabase = database;
	return database;
}

export function db(): TidepoolDatabase {
	if (!openedDatabase)
		throw new Error('Database accessed before openDatabase() ran in the init hook');
	return openedDatabase;
}
