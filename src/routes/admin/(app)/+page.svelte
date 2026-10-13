<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { formatShortDate } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const weeklyConfig = {
		events: { label: 'Events', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const accountConfig = {
		posts: { label: 'Posts', color: 'var(--chart-3)' }
	} satisfies Chart.ChartConfig;

	const weeklyData = $derived(
		data.stats.upcomingPerWeek.map((week) => ({
			week: formatShortDate(week.weekStart),
			events: week.events
		}))
	);
</script>

<svelte:head><title>Dashboard · Tidepool</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Dashboard</h1>

<div class="grid gap-4 sm:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Description>Total posts</Card.Description>
			<Card.Title class="text-3xl tabular-nums">{data.stats.totalPosts}</Card.Title>
		</Card.Header>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Description>Upcoming posts</Card.Description>
			<Card.Title class="text-3xl tabular-nums">{data.stats.upcomingPosts}</Card.Title>
		</Card.Header>
	</Card.Root>
</div>

<div class="mt-4 grid gap-4 lg:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Upcoming events per week</Card.Title>
			<Card.Description>Next {data.weeks} weeks, in 7-day windows starting today</Card.Description>
		</Card.Header>
		<Card.Content>
			<Chart.Container config={weeklyConfig} class="h-64 w-full">
				<BarChart
					data={weeklyData}
					x="week"
					xScale={scaleBand().padding(0.25)}
					axis
					series={[
						{ key: 'events', label: weeklyConfig.events.label, color: weeklyConfig.events.color }
					]}
					props={{ bars: { radius: 4, strokeWidth: 0 } }}
				>
					{#snippet tooltip()}
						<Chart.Tooltip />
					{/snippet}
				</BarChart>
			</Chart.Container>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Posts per source account</Card.Title>
			<Card.Description>All posts, past and upcoming</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.stats.postsPerSourceAccount.length === 0}
				<p class="text-sm text-muted-foreground">No posts yet.</p>
			{:else}
				<Chart.Container
					config={accountConfig}
					class="aspect-auto w-full"
					style="height: {Math.max(8, data.stats.postsPerSourceAccount.length * 2.5)}rem"
				>
					<BarChart
						data={data.stats.postsPerSourceAccount}
						orientation="horizontal"
						y="sourceAccount"
						yScale={scaleBand().padding(0.25)}
						axis
						series={[
							{ key: 'posts', label: accountConfig.posts.label, color: accountConfig.posts.color }
						]}
						props={{ bars: { radius: 4, strokeWidth: 0 } }}
						padding={{ left: 120 }}
					>
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
