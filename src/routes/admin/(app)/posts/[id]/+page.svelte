<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { formatDateTime } from '$lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(
		form?.values ?? {
			title: data.post.title,
			start: data.post.start,
			end: data.post.end ?? '',
			location: data.post.location ?? '',
			summary: data.post.summary ?? ''
		}
	);

	const sourceFields = $derived([
		{ label: 'Source', value: data.post.source },
		{ label: 'Source account', value: data.post.sourceAccount },
		{ label: 'Source ID', value: data.post.sourceId },
		{ label: 'Posted at', value: formatDateTime(data.post.sourcePostedAt) },
		{ label: 'Created', value: formatDateTime(data.post.createdAt) },
		{ label: 'Updated', value: formatDateTime(data.post.updatedAt) }
	]);
</script>

<svelte:head><title>Edit post · Tidepool</title></svelte:head>

<div class="mb-6 flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Edit post</h1>
	<Button href={resolve('/admin/posts')} variant="ghost">Back to posts</Button>
</div>

<div class="grid gap-4 lg:grid-cols-3">
	<Card.Root class="lg:col-span-2">
		<Card.Content>
			<form method="POST" use:enhance class="grid gap-4">
				<div class="grid gap-2">
					<Label for="title">Title</Label>
					<Input id="title" name="title" value={values.title} required />
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-2">
						<Label for="start">Start</Label>
						<Input
							id="start"
							name="start"
							value={values.start}
							placeholder="2026-10-10T20:00:00+09:00"
							required
						/>
					</div>
					<div class="grid gap-2">
						<Label for="end">End (optional)</Label>
						<Input id="end" name="end" value={values.end} placeholder="2026-10-10T23:00:00+09:00" />
					</div>
				</div>
				<p class="text-xs text-muted-foreground">
					Times are ISO 8601 with seconds and a UTC offset, e.g. 2026-10-10T20:00:00+09:00.
				</p>
				<div class="grid gap-2">
					<Label for="location">Location (optional)</Label>
					<Input id="location" name="location" value={values.location} />
				</div>
				<div class="grid gap-2">
					<Label for="summary">Summary (optional)</Label>
					<Textarea id="summary" name="summary" value={values.summary} rows={6} />
				</div>
				{#if form?.message}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.message}</Alert.Description>
					</Alert.Root>
				{/if}
				<div>
					<Button type="submit">Save changes</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		{#if data.post.hasImage}
			<Card.Content>
				<a
					href={resolve('/posts/[id]/image', { id: String(data.post.id) })}
					target="_blank"
					rel="noopener noreferrer"
				>
					<img
						src={resolve('/posts/[id]/image', { id: String(data.post.id) })}
						alt="Original post: {data.post.title}"
						class="w-full rounded-md border"
					/>
				</a>
			</Card.Content>
		{/if}
		<Card.Header>
			<Card.Title>Source</Card.Title>
			<Card.Description>Set by the import; read-only.</Card.Description>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-3 text-sm">
				{#each sourceFields as field (field.label)}
					<div>
						<dt class="text-muted-foreground">{field.label}</dt>
						<dd class="break-all">{field.value}</dd>
					</div>
				{/each}
				<div>
					<dt class="text-muted-foreground">Original post</dt>
					<dd class="break-all">
						<a
							href={data.post.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary hover:underline"
						>
							{data.post.sourceUrl}
						</a>
					</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>
</div>
