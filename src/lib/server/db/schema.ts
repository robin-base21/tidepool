import { sql } from 'drizzle-orm';
import {
	blob,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable(
	'posts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		source: text('source').notNull(),
		sourceAccount: text('source_account').notNull(),
		sourceId: text('source_id').notNull(),
		sourceUrl: text('source_url').notNull(),
		sourcePostedAt: text('source_posted_at').notNull(),
		title: text('title').notNull(),
		start: text('start').notNull(),
		end: text('end'),
		location: text('location'),
		summary: text('summary'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('posts_source_source_id_unique').on(table.source, table.sourceId),
		index('posts_start_instant_id_idx').on(sql`unixepoch("start")`, table.id),
		index('posts_source_account_idx').on(table.sourceAccount),
		index('posts_updated_at_idx').on(table.updatedAt)
	]
);

export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const postImages = sqliteTable('post_images', {
	postId: integer('post_id')
		.primaryKey()
		.references(() => posts.id, { onDelete: 'cascade' }),
	mime: text('mime', { enum: imageMimeTypes }).notNull(),
	data: blob('data', { mode: 'buffer' }).notNull()
});

export const seenOutcomes = ['event', 'not_event'] as const;

/**
 * Every source post n8n has classified, so it can skip them next time. Not tied to `posts`:
 * deleting a post keeps it seen, so a deleted false positive is never imported again.
 */
export const seenPosts = sqliteTable(
	'seen_posts',
	{
		source: text('source').notNull(),
		sourceId: text('source_id').notNull(),
		outcome: text('outcome', { enum: seenOutcomes }).notNull(),
		seenAt: text('seen_at').notNull()
	},
	(table) => [primaryKey({ columns: [table.source, table.sourceId] })]
);

export const apiKeys = sqliteTable('api_keys', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	scope: text('scope', { enum: ['read', 'write'] }).notNull(),
	keyHash: text('key_hash').notNull().unique(),
	keyPrefix: text('key_prefix').notNull(),
	createdAt: text('created_at').notNull(),
	lastUsedAt: text('last_used_at')
});

export type Post = typeof posts.$inferSelect;
export type ImageMimeType = (typeof imageMimeTypes)[number];
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiKeyScope = ApiKey['scope'];
