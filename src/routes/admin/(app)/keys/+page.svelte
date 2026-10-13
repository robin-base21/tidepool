<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { formatDateTime } from '$lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const scopeLabels = { read: 'Read', write: 'Write (includes read)' } as const;

	let scope = $state<'read' | 'write'>('read');
	let copied = $state(false);
	let keyToDelete = $state<{ id: number; name: string } | null>(null);
	let deleteDialogOpen = $state(false);

	async function copyKey(key: string) {
		await navigator.clipboard.writeText(key);
		copied = true;
	}

	function confirmDelete(apiKey: { id: number; name: string }) {
		keyToDelete = apiKey;
		deleteDialogOpen = true;
	}
</script>

<svelte:head><title>API keys · Tidepool</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">API keys</h1>

<Card.Root class="mb-6">
	<Card.Header>
		<Card.Title>Create a key</Card.Title>
		<Card.Description>Use a write key for n8n and read keys for scrapers.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				copied = false;
				return async ({ update }) => {
					await update();
					// The form reset clears the select; restore its default.
					scope = 'read';
				};
			}}
			class="flex flex-wrap items-end gap-3"
		>
			<div class="grid gap-2">
				<Label for="name">Name</Label>
				<Input id="name" name="name" placeholder="n8n" required class="w-64" />
			</div>
			<div class="grid gap-2">
				<Label>Scope</Label>
				<Select.Root type="single" name="scope" bind:value={scope}>
					<Select.Trigger class="w-52">{scopeLabels[scope]}</Select.Trigger>
					<Select.Content>
						{#each Object.entries(scopeLabels) as [value, label] (value)}
							<Select.Item {value} {label} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<Button type="submit">Create key</Button>
		</form>

		{#if form?.message}
			<Alert.Root variant="destructive" class="mt-4">
				<Alert.Description>{form.message}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if form?.createdKey}
			<Alert.Root class="mt-4">
				<Alert.Title>Key “{form.createdKey.name}” created ({form.createdKey.scope})</Alert.Title>
				<Alert.Description>
					<p>Copy it now. It is not stored and will not be shown again.</p>
					<div class="mt-2 flex w-full items-center gap-2">
						<code
							class="flex-1 rounded bg-muted px-2 py-1.5 font-mono text-xs break-all text-foreground"
						>
							{form.createdKey.key}
						</code>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => copyKey(form.createdKey.key)}
						>
							{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
				</Alert.Description>
			</Alert.Root>
		{/if}
	</Card.Content>
</Card.Root>

<div class="rounded-lg border bg-background">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Scope</Table.Head>
				<Table.Head>Prefix</Table.Head>
				<Table.Head>Created</Table.Head>
				<Table.Head>Last used</Table.Head>
				<Table.Head class="text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.apiKeys as apiKey (apiKey.id)}
				<Table.Row>
					<Table.Cell class="font-medium">{apiKey.name}</Table.Cell>
					<Table.Cell>
						<Badge variant={apiKey.scope === 'write' ? 'default' : 'secondary'}
							>{apiKey.scope}</Badge
						>
					</Table.Cell>
					<Table.Cell class="font-mono text-xs">{apiKey.keyPrefix}…</Table.Cell>
					<Table.Cell class="whitespace-nowrap tabular-nums"
						>{formatDateTime(apiKey.createdAt)}</Table.Cell
					>
					<Table.Cell class="whitespace-nowrap tabular-nums">
						{apiKey.lastUsedAt === null ? 'Never' : formatDateTime(apiKey.lastUsedAt)}
					</Table.Cell>
					<Table.Cell class="text-right">
						<Button
							variant="ghost"
							size="sm"
							class="text-destructive"
							onclick={() => confirmDelete(apiKey)}
						>
							Delete
						</Button>
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={6} class="py-8 text-center text-muted-foreground"
						>No API keys yet.</Table.Cell
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
				<AlertDialog.Title>Delete this key?</AlertDialog.Title>
				<AlertDialog.Description>
					Anything using “{keyToDelete?.name}” will immediately get 401 responses.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<input type="hidden" name="id" value={keyToDelete?.id} />
			<AlertDialog.Footer class="mt-4">
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
