<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { formatDateTime } from '$lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const timeframeLabels = { upcoming: 'Upcoming', past: 'Past', all: 'All' } as const;

	let when = $derived(data.filter.when);
	let postToDelete = $state<{ id: number; title: string } | null>(null);
	let deleteDialogOpen = $state(false);

	function confirmDelete(post: { id: number; title: string }) {
		postToDelete = post;
		deleteDialogOpen = true;
	}
</script>

<svelte:head><title>Posts · Tidepool</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Posts</h1>

<form method="GET" class="mb-4 flex flex-wrap items-center gap-2">
	<Input name="q" type="search" placeholder="Search titles" value={data.filter.q} class="w-64" />
	<Select.Root type="single" name="when" bind:value={when}>
		<Select.Trigger class="w-32">{timeframeLabels[when]}</Select.Trigger>
		<Select.Content>
			{#each Object.entries(timeframeLabels) as [value, label] (value)}
				<Select.Item {value} {label} />
			{/each}
		</Select.Content>
	</Select.Root>
	<Button type="submit" variant="secondary">Apply</Button>
</form>

{#if form?.message}
	<Alert.Root variant="destructive" class="mb-4">
		<Alert.Description>{form.message}</Alert.Description>
	</Alert.Root>
{/if}

<div class="rounded-lg border bg-background">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-16">Image</Table.Head>
				<Table.Head>Title</Table.Head>
				<Table.Head>Start</Table.Head>
				<Table.Head>Location</Table.Head>
				<Table.Head>Source account</Table.Head>
				<Table.Head>Source</Table.Head>
				<Table.Head class="text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.posts as post (post.id)}
				<Table.Row>
					<Table.Cell>
						{#if post.hasImage}
							<img
								src={resolve('/posts/[id]/image', { id: String(post.id) })}
								alt=""
								loading="lazy"
								class="size-10 rounded-md object-cover"
							/>
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</Table.Cell>
					<Table.Cell class="max-w-xs truncate font-medium">
						<a
							href={resolve('/admin/(app)/posts/[id]', { id: String(post.id) })}
							class="hover:underline">{post.title}</a
						>
					</Table.Cell>
					<Table.Cell class="whitespace-nowrap tabular-nums"
						>{formatDateTime(post.start)}</Table.Cell
					>
					<Table.Cell class="max-w-48 truncate">{post.location ?? '—'}</Table.Cell>
					<Table.Cell>{post.sourceAccount}</Table.Cell>
					<Table.Cell>
						<a
							href={post.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary underline-offset-4 hover:underline"
						>
							Open ↗
						</a>
					</Table.Cell>
					<Table.Cell class="text-right whitespace-nowrap">
						<Button
							href={resolve('/admin/(app)/posts/[id]', { id: String(post.id) })}
							variant="ghost"
							size="sm">Edit</Button
						>
						<Button
							variant="ghost"
							size="sm"
							class="text-destructive"
							onclick={() => confirmDelete(post)}
						>
							Delete
						</Button>
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={7} class="py-8 text-center text-muted-foreground"
						>No posts match.</Table.Cell
					>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>

<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					deleteDialogOpen = false;
				};
			}}
		>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete this post?</AlertDialog.Title>
				<AlertDialog.Description>
					“{postToDelete?.title}” will be removed permanently. It stays marked as seen, so n8n won’t
					import it again.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<input type="hidden" name="id" value={postToDelete?.id} />
			<AlertDialog.Footer class="mt-4">
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
