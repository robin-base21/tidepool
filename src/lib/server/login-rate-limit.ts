const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** Failed login timestamps per client IP. In memory: a restart clears it. */
const failedAttempts = new Map<string, number[]>();

function recentFailures(ip: string, now: Date): number[] {
	const cutoff = now.getTime() - WINDOW_MS;
	return (failedAttempts.get(ip) ?? []).filter((timestamp) => timestamp > cutoff);
}

/** Minutes until the IP may try again, or null if it is not blocked. */
export function loginBlockedForMinutes(ip: string, now: Date): number | null {
	const failures = recentFailures(ip, now);
	if (failures.length < MAX_FAILED_ATTEMPTS) return null;
	const unblockedAt = failures[failures.length - MAX_FAILED_ATTEMPTS] + WINDOW_MS;
	return Math.ceil((unblockedAt - now.getTime()) / 60_000);
}

export function recordFailedLogin(ip: string, now: Date): void {
	for (const knownIp of failedAttempts.keys()) {
		if (recentFailures(knownIp, now).length === 0) failedAttempts.delete(knownIp);
	}
	failedAttempts.set(ip, [...recentFailures(ip, now), now.getTime()]);
}

export function clearFailedLogins(ip: string): void {
	failedAttempts.delete(ip);
}
