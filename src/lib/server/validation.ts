import { error } from '@sveltejs/kit';
import { z } from 'zod';

/** Error message for a field that reports a missing value as "is required". */
export function requiredOr(message: string) {
	return (issue: { input?: unknown }) => (issue.input === undefined ? 'is required' : message);
}

export const isoDateTimeWithOffset = z.iso.datetime({
	offset: true,
	error: requiredOr(
		'must be an ISO 8601 datetime with seconds and a UTC offset, e.g. 2026-10-10T20:00:00+09:00'
	)
});

export function formatValidationError(validationError: z.ZodError): string {
	return validationError.issues
		.map((issue) =>
			issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message
		)
		.join('; ');
}

export function parseOrBadRequest<Schema extends z.ZodType>(
	schema: Schema,
	input: unknown
): z.output<Schema> {
	const result = schema.safeParse(input);
	if (!result.success) error(400, formatValidationError(result.error));
	return result.data;
}

export async function readJsonBody(request: Request): Promise<unknown> {
	const body = await request.text();
	try {
		return JSON.parse(body);
	} catch {
		error(400, 'Request body must be valid JSON');
	}
}

const ID_MESSAGE = 'id must be a positive integer';
export const idSchema = z.coerce.number({ error: ID_MESSAGE }).int(ID_MESSAGE).positive(ID_MESSAGE);

export function parseFormData<Schema extends z.ZodType>(schema: Schema, formData: FormData) {
	return schema.safeParse(Object.fromEntries(formData));
}
