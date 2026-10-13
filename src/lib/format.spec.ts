import { describe, expect, it } from 'vitest';
import { formatEventTime } from './format';

describe('formatEventTime', () => {
	it('shows the start in its own offset', () => {
		expect(formatEventTime('2026-10-10T20:00:00+09:00', null)).toBe('Sat, Oct 10 · 20:00');
	});

	it('shows only the end time when the event ends the same day', () => {
		expect(formatEventTime('2026-10-10T20:00:00+09:00', '2026-10-10T23:30:00+09:00')).toBe(
			'Sat, Oct 10 · 20:00–23:30'
		);
	});

	it('shows the end date when the event ends on another day', () => {
		expect(formatEventTime('2026-10-10T20:00:00Z', '2026-10-11T02:00:00Z')).toBe(
			'Sat, Oct 10 · 20:00 – Sun, Oct 11 · 02:00'
		);
	});
});
