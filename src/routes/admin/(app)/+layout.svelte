<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';

	let { children } = $props();

	const links = [
		{ href: resolve('/admin'), label: 'Dashboard' },
		{ href: resolve('/admin/posts'), label: 'Posts' },
		{ href: resolve('/admin/keys'), label: 'API keys' }
	];

	function isCurrent(href: string): boolean {
		const path = page.url.pathname;
		return href === resolve('/admin')
			? path === href
			: path === href || path.startsWith(`${href}/`);
	}
</script>

<div class="min-h-screen bg-muted/30">
	<header class="border-b bg-background">
		<div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
			<a href={resolve('/admin')} class="font-semibold">Tidepool</a>
			<nav class="flex flex-1 gap-1">
				{#each links as link (link.href)}
					<Button href={link.href} variant={isCurrent(link.href) ? 'secondary' : 'ghost'} size="sm">
						{link.label}
					</Button>
				{/each}
			</nav>
			<form method="POST" action="{resolve('/admin/login')}?/logout">
				<Button type="submit" variant="outline" size="sm">Log out</Button>
			</form>
		</div>
	</header>
	<main class="mx-auto max-w-6xl px-4 py-8">
		{@render children()}
	</main>
</div>
