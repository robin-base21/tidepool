import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { seenPosts } from './db/schema';
import { requiredOr, requiredText } from './validation';

export const MAX_SEEN_CHECK_IDS = 100;

export const markSeenSchema = z.strictObject({
	source: requiredText,
	source_id: requiredText,
	outcome: z.literal('not_event', {
		error: requiredOr('must be "not_event"; events are marked seen by POST /posts')
	})
});

export type MarkSeen = z.output<typeof markSeenSchema>;

export const seenCheckSchema = z.strictObject({
	source: requiredText,
	source_ids: z
		.array(requiredText, { error: requiredOr('must be an array of strings') })
		.min(1, `must contain 1 to ${MAX_SEEN_CHECK_IDS} ids`)
		.max(MAX_SEEN_CHECK_IDS, `must contain 1 to ${MAX_SEEN_CHECK_IDS} ids`)
});

export type SeenCheck = z.output<typeof seenCheckSchema>;

/** Records a post n8n classified as not an event. A post already seen keeps its first outcome. */
export function markNotEventSeen(input: MarkSeen, now: Date): void {
	db()
		.insert(seenPosts)
		.values({
			source: input.source,
			sourceId: input.source_id,
			outcome: input.outcome,
			seenAt: now.toISOString()
		})
		.onConflictDoNothing()
		.run();
}

/** The ids not seen before, in input order. */
export function findUnseenIds(check: SeenCheck): string[] {
	const seen = new Set(
		db()
			.select({ sourceId: seenPosts.sourceId })
			.from(seenPosts)
			.where(and(eq(seenPosts.source, check.source), inArray(seenPosts.sourceId, check.source_ids)))
			.all()
			.map((row) => row.sourceId)
	);
	return check.source_ids.filter((id) => !seen.has(id));
}
