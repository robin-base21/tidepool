import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	gt,
	gte,
	lt,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import { z } from 'zod';
import { getConfig } from './config';
import { db } from './db';
import { postImages, posts, type Post } from './db/schema';
import { imageDataUrlSchema } from './images';
import { isoDateTimeWithOffset, requiredOr } from './validation';

const requiredText = z
	.string({ error: requiredOr('must be a string') })
	.trim()
	.min(1, 'must not be empty');

function endNotBeforeStart(input: { start: string; end: string | null }): boolean {
	return input.end === null || Date.parse(input.end) >= Date.parse(input.start);
}

export const newPostSchema = z
	.strictObject({
		source: requiredText,
		source_account: requiredText,
		source_id: requiredText,
		source_url: z.url({ protocol: /^https?$/, error: requiredOr('must be an http(s) URL') }),
		source_posted_at: isoDateTimeWithOffset,
		title: requiredText,
		start: isoDateTimeWithOffset,
		end: isoDateTimeWithOffset.nullable(),
		location: requiredText.nullable(),
		summary: requiredText.nullable(),
		image: imageDataUrlSchema
	})
	.refine(endNotBeforeStart, { path: ['end'], message: 'must not be before start' });

export type NewPost = z.output<typeof newPostSchema>;

/** Form fields arrive as strings; an empty optional field means null. */
function optionalFormField<Schema extends z.ZodType<string, string>>(schema: Schema) {
	return z
		.string()
		.trim()
		.transform((value) => (value === '' ? null : value))
		.pipe(schema.nullable());
}

export const postEditSchema = z
	.object({
		title: requiredText,
		start: isoDateTimeWithOffset,
		end: optionalFormField(isoDateTimeWithOffset),
		location: optionalFormField(z.string()),
		summary: optionalFormField(z.string())
	})
	.refine(endNotBeforeStart, { path: ['end'], message: 'must not be before start' });

export type PostEdit = z.output<typeof postEditSchema>;

const cursorSchema = z.tuple([z.number().int(), z.number().int().positive()]);

function encodeCursor(startSeconds: number, id: number): string {
	return Buffer.from(JSON.stringify([startSeconds, id])).toString('base64url');
}

function decodeCursor(cursor: string): z.output<typeof cursorSchema> | null {
	try {
		const result = cursorSchema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export const listPostsQuerySchema = z.strictObject({
	start_from: isoDateTimeWithOffset.optional(),
	start_to: isoDateTimeWithOffset.optional(),
	updated_since: isoDateTimeWithOffset.optional(),
	source_account: requiredText.optional(),
	limit: z.coerce
		.number({ error: 'must be a number' })
		.int('must be an integer')
		.min(1, 'must be between 1 and 200')
		.max(200, 'must be between 1 and 200')
		.default(50),
	cursor: z
		.string()
		.transform((cursor, context) => {
			const decoded = decodeCursor(cursor);
			if (decoded === null) {
				context.addIssue({ code: 'custom', message: 'is not a valid cursor' });
				return z.NEVER;
			}
			return decoded;
		})
		.optional()
});

export type ListPostsQuery = z.output<typeof listPostsQuerySchema>;

export type PostResource = {
	id: number;
	source: string;
	source_account: string;
	source_id: string;
	source_url: string;
	source_posted_at: string;
	title: string;
	start: string;
	end: string | null;
	location: string | null;
	summary: string | null;
	/** Null only for posts created before images were required. */
	image_url: string | null;
	created_at: string;
	updated_at: string;
};

export type PostWithImageFlag = Post & { hasImage: boolean };

/** Selects a post plus whether it has an image, without loading the image data. */
const postWithImageFlag = {
	...getTableColumns(posts),
	hasImage:
		sql<boolean>`exists(select 1 from ${postImages} where ${postImages.postId} = ${posts.id})`.mapWith(
			Boolean
		)
};

export function postImageUrl(postId: number): string {
	return new URL(`/posts/${postId}/image`, getConfig().origin).href;
}

export function toPostResource(post: PostWithImageFlag): PostResource {
	return {
		id: post.id,
		source: post.source,
		source_account: post.sourceAccount,
		source_id: post.sourceId,
		source_url: post.sourceUrl,
		source_posted_at: post.sourcePostedAt,
		title: post.title,
		start: post.start,
		end: post.end,
		location: post.location,
		summary: post.summary,
		image_url: post.hasImage ? postImageUrl(post.id) : null,
		created_at: post.createdAt,
		updated_at: post.updatedAt
	};
}

/** `start` keeps its original offset, so compare and order by the instant it denotes. */
const startInstant = sql<number>`unixepoch(${posts.start})`;

function instant(isoDateTime: string): SQL<number> {
	return sql<number>`unixepoch(${isoDateTime})`;
}

/**
 * Inserts a new post with its image. An existing (source, source_id) is returned unchanged,
 * image included, so admin edits survive re-sends.
 */
export function createPostIfAbsent(
	input: NewPost,
	now: Date
): { post: PostWithImageFlag; created: boolean } {
	const timestamp = now.toISOString();
	const created = db().transaction((transaction) => {
		const inserted = transaction
			.insert(posts)
			.values({
				source: input.source,
				sourceAccount: input.source_account,
				sourceId: input.source_id,
				sourceUrl: input.source_url,
				sourcePostedAt: input.source_posted_at,
				title: input.title,
				start: input.start,
				end: input.end,
				location: input.location,
				summary: input.summary,
				createdAt: timestamp,
				updatedAt: timestamp
			})
			.onConflictDoNothing({ target: [posts.source, posts.sourceId] })
			.returning({ id: posts.id })
			.get();
		if (inserted === undefined) return false;
		transaction
			.insert(postImages)
			.values({ postId: inserted.id, mime: input.image.mime, data: input.image.data })
			.run();
		return true;
	});

	const post = db()
		.select(postWithImageFlag)
		.from(posts)
		.where(and(eq(posts.source, input.source), eq(posts.sourceId, input.source_id)))
		.get();
	if (post === undefined)
		throw new Error(`Post ${input.source}/${input.source_id} was not found after insert`);
	return { post, created };
}

export function listPostsForApi(query: ListPostsQuery): {
	posts: PostResource[];
	next_cursor: string | null;
} {
	const conditions: SQL[] = [];
	if (query.start_from !== undefined) conditions.push(gte(startInstant, instant(query.start_from)));
	if (query.start_to !== undefined) conditions.push(lt(startInstant, instant(query.start_to)));
	if (query.updated_since !== undefined) {
		conditions.push(gte(posts.updatedAt, new Date(query.updated_since).toISOString()));
	}
	if (query.source_account !== undefined)
		conditions.push(eq(posts.sourceAccount, query.source_account));
	if (query.cursor !== undefined) {
		const [afterStart, afterId] = query.cursor;
		const afterCursor = or(
			gt(startInstant, afterStart),
			and(eq(startInstant, afterStart), gt(posts.id, afterId))
		);
		if (afterCursor !== undefined) conditions.push(afterCursor);
	}

	const rows = db()
		.select({ post: postWithImageFlag, startSeconds: startInstant })
		.from(posts)
		.where(and(...conditions))
		.orderBy(asc(startInstant), asc(posts.id))
		.limit(query.limit + 1)
		.all();

	const page = rows.slice(0, query.limit);
	const last = page[page.length - 1];
	return {
		posts: page.map((row) => toPostResource(row.post)),
		next_cursor: rows.length > query.limit ? encodeCursor(last.startSeconds, last.post.id) : null
	};
}

export function getPost(id: number): PostWithImageFlag | undefined {
	return db().select(postWithImageFlag).from(posts).where(eq(posts.id, id)).get();
}

export const postTimeframes = ['upcoming', 'past', 'all'] as const;

export const adminPostFilterSchema = z.object({
	q: z.string().trim().default(''),
	when: z.enum(postTimeframes, { error: 'when must be upcoming, past or all' }).default('upcoming')
});

export type AdminPostFilter = z.output<typeof adminPostFilterSchema>;

export function listPostsForAdmin(filter: AdminPostFilter, now: Date): PostWithImageFlag[] {
	const conditions: SQL[] = [];
	if (filter.q !== '') conditions.push(sql`instr(lower(${posts.title}), lower(${filter.q})) > 0`);
	if (filter.when === 'upcoming') conditions.push(gte(startInstant, instant(now.toISOString())));
	if (filter.when === 'past') conditions.push(lt(startInstant, instant(now.toISOString())));

	const order = filter.when === 'upcoming' ? asc : desc;
	return db()
		.select(postWithImageFlag)
		.from(posts)
		.where(and(...conditions))
		.orderBy(order(startInstant), order(posts.id))
		.all();
}

export function updatePost(id: number, edit: PostEdit, now: Date): Post | undefined {
	return db()
		.update(posts)
		.set({ ...edit, updatedAt: now.toISOString() })
		.where(eq(posts.id, id))
		.returning()
		.get();
}

export function deletePost(id: number): boolean {
	return db().delete(posts).where(eq(posts.id, id)).run().changes > 0;
}

const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;
export const DASHBOARD_WEEKS = 8;

export type DashboardStats = {
	totalPosts: number;
	upcomingPosts: number;
	upcomingPerWeek: { weekStart: string; events: number }[];
	postsPerSourceAccount: { sourceAccount: string; posts: number }[];
};

/** Weeks are rolling 7-day windows starting at `now`. */
export function getDashboardStats(now: Date): DashboardStats {
	const nowSeconds = Math.floor(now.getTime() / 1000);
	const nowInstant = instant(now.toISOString());

	const [{ totalPosts }] = db().select({ totalPosts: count() }).from(posts).all();
	const [{ upcomingPosts }] = db()
		.select({ upcomingPosts: count() })
		.from(posts)
		.where(gte(startInstant, nowInstant))
		.all();

	// better-sqlite3 binds JS numbers as REAL, so cast to get whole week numbers.
	const weekIndex = sql<number>`cast((${startInstant} - ${nowSeconds}) / ${SECONDS_PER_WEEK} as integer)`;
	const eventsByWeek = db()
		.select({ week: weekIndex, events: count() })
		.from(posts)
		.where(
			and(
				gte(startInstant, nowInstant),
				lt(startInstant, nowSeconds + DASHBOARD_WEEKS * SECONDS_PER_WEEK)
			)
		)
		.groupBy(weekIndex)
		.all();

	const upcomingPerWeek = Array.from({ length: DASHBOARD_WEEKS }, (_, week) => ({
		weekStart: new Date((nowSeconds + week * SECONDS_PER_WEEK) * 1000).toISOString(),
		events: eventsByWeek.find((row) => row.week === week)?.events ?? 0
	}));

	const postsPerSourceAccount = db()
		.select({ sourceAccount: posts.sourceAccount, posts: count() })
		.from(posts)
		.groupBy(posts.sourceAccount)
		.orderBy(desc(count()), asc(posts.sourceAccount))
		.all();

	return { totalPosts, upcomingPosts, upcomingPerWeek, postsPerSourceAccount };
}
