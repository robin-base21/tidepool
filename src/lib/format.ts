const ISO_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Shows an ISO datetime in its own offset, e.g. "2026-10-10 20:00 +09:00", so server and browser render the same text. */
export function formatDateTime(isoDateTime: string): string {
	const match = ISO_DATE_TIME.exec(isoDateTime);
	if (match === null) throw new Error(`Not an ISO datetime with offset: ${isoDateTime}`);
	const [, date, time, offset] = match;
	return `${date} ${time} ${offset === 'Z' ? 'UTC' : offset}`;
}

export function formatShortDate(isoDateTime: string): string {
	return new Date(isoDateTime).toLocaleDateString('en', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
