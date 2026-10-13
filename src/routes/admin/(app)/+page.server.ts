import { DASHBOARD_WEEKS, getDashboardStats } from '$lib/server/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { stats: getDashboardStats(new Date()), weeks: DASHBOARD_WEEKS };
};
