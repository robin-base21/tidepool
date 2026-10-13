const ISO_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function splitDateTime(isoDateTime: string): { date: string; time: string; offset: string } {
	const match = ISO_DATE_TIME.exec(isoDateTime);
	if (match === null) throw new Error(`Not an ISO datetime with offset: ${isoDateTime}`);
	const [, date, time, offset] = match;
	return { date, time, offset };
}

/** Shows an ISO datetime in its own offset, e.g. "2026-10-10 20:00 +09:00", so server and browser render the same text. */
export function formatDateTime(isoDateTime: string): string {
	const { date, time, offset } = splitDateTime(isoDateTime);
	return `${date} ${time} ${offset === 'Z' ? 'UTC' : offset}`;
}

/** "2026-10-10" → "Sat, Oct 10" */
function formatCalendarDate(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString('en', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}

/**
 * Shows when an event happens in its own offset, the local time at the venue, e.g.
 * "Sat, Oct 10 · 20:00–23:00" or "Sat, Oct 10 · 20:00 – Sun, Oct 11 · 02:00".
 */
export function formatEventTime(start: string, end: string | null): string {
	const from = splitDateTime(start);
	const startText = `${formatCalendarDate(from.date)} · ${from.time}`;
	if (end === null) return startText;
	const to = splitDateTime(end);
	return to.date === from.date
		? `${startText}–${to.time}`
		: `${startText} – ${formatCalendarDate(to.date)} · ${to.time}`;
}

export function formatShortDate(isoDateTime: string): string {
	return new Date(isoDateTime).toLocaleDateString('en', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
