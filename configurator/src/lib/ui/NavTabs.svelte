<script lang="ts">
	/**
	 * @file NavTabs.svelte
	 * @brief Shared section navigation: a row of links with the current one marked.
	 */
	interface Props {
		label: string;
		items: readonly { href: string; label: string; current: boolean }[];
	}

	let { label, items }: Props = $props(); // accessible name, links
</script>

<nav aria-label={label}>
	{#each items as item (item.href)}
		<a href={item.href} aria-current={item.current ? 'page' : undefined}>{item.label}</a>
	{/each}
</nav>

<style>
	nav {
		display: flex;
		gap: 4px;
	}

	a {
		padding: 6px 12px;
		border-radius: var(--radius-small);
		color: var(--text-muted);
		font-weight: 600;
		text-decoration: none;
		user-select: none;
	}

	a:hover {
		color: var(--text);
		background: var(--surface-raised);
	}

	a[aria-current='page'] {
		color: var(--text);
		background: var(--surface-raised);
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
