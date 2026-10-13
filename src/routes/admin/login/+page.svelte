<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Log in · Tidepool</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-muted/30 px-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>Tidepool admin</Card.Title>
			<Card.Description>Enter the admin password to continue.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/login" use:enhance class="grid gap-4">
				<div class="grid gap-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>
				{#if form?.message}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.message}</Alert.Description>
					</Alert.Root>
				{/if}
				<Button type="submit">Log in</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
