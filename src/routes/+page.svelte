<script lang="ts">
	import { resolve } from '$app/paths';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatEventTime } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Grows as more pages load; resets if the page data changes.
	let events = $derived(data.events);
	let nextCursor = $derived(data.nextCursor);
	let loading = $state(false);
	let loadFailed = $state(false);

	async function loadMore() {
		if (loading || nextCursor === null) return;
		loading = true;
		loadFailed = false;
		try {
			const response = await fetch(
				`${resolve('/events')}?${new URLSearchParams({ cursor: nextCursor })}`
			);
			if (!response.ok) throw new Error(`GET /events failed with ${response.status}`);
			const page: typeof data = await response.json();
			events = [...events, ...page.events];
			nextCursor = page.nextCursor;
		} catch {
			loadFailed = true;
		} finally {
			loading = false;
		}
	}

	/**
	 * Loads the next page when the sentinel nears the viewport. Reading `nextCursor` re-runs this
	 * after each page, and a fresh observer reports right away, so a screen taller than the
	 * loaded events keeps filling.
	 */
	function loadWhenVisible(node: HTMLElement) {
		if (nextCursor === null) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting) && !loadFailed) loadMore();
			},
			{ rootMargin: '800px 0px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}
</script>

<svelte:head><title>Upcoming events · Tidepool</title></svelte:head>

<div class="min-h-screen bg-muted/30">
	<main class="mx-auto max-w-xl px-4 py-10">
		<header class="mb-8">
			<h1 class="text-2xl font-semibold">Upcoming events</h1>
		</header>

		<div class="space-y-6">
			{#each events as event (event.id)}
				<article class="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
					{#if event.hasImage}
						<img
							src={resolve('/events/[id]/image', { id: String(event.id) })}
							alt=""
							loading="lazy"
							class="w-full bg-muted"
						/>
					{/if}
					<div class="space-y-3 p-5">
						<h2 class="text-lg leading-snug font-semibold">{event.title}</h2>
						<div class="space-y-1 text-sm text-muted-foreground">
							<p class="flex items-start gap-2">
								<CalendarIcon class="mt-0.5 size-4 shrink-0" />
								<time datetime={event.start}>{formatEventTime(event.start, event.end)}</time>
							</p>
							{#if event.location}
								<p class="flex items-start gap-2">
									<MapPinIcon class="mt-0.5 size-4 shrink-0" />
									<span>{event.location}</span>
								</p>
							{/if}
						</div>
						{#if event.summary}
							<p class="text-sm whitespace-pre-line">{event.summary}</p>
						{/if}
						<a
							href={event.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
						>
							{event.sourceAccount}
							<ExternalLinkIcon class="size-3.5" />
						</a>
					</div>
				</article>
			{:else}
				<p class="py-16 text-center text-muted-foreground">No upcoming events right now.</p>
			{/each}
		</div>

		{#if nextCursor !== null}
			<div class="mt-8 flex justify-center" {@attach loadWhenVisible}>
				{#if loading}
					<p class="text-sm text-muted-foreground">Loading more events…</p>
				{:else if loadFailed}
					<Button variant="outline" onclick={loadMore}>Couldn’t load more. Try again</Button>
				{:else}
					<!-- Without JavaScript this link pages through the feed. -->
					<Button
						variant="outline"
						href="?{new URLSearchParams({ cursor: nextCursor })}"
						onclick={(clickEvent: MouseEvent) => {
							clickEvent.preventDefault();
							loadMore();
						}}
					>
						More events
					</Button>
				{/if}
			</div>
		{:else if events.length > 0}
			<p class="mt-8 text-center text-sm text-muted-foreground">That’s everything coming up.</p>
		{/if}
	</main>
</div>
