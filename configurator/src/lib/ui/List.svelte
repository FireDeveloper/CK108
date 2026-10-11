<script lang="ts">
	/**
	 * @file List.svelte
	 * @brief Shared bordered list of ListItem rows, optionally scrolling past a fixed height.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		scroll?: boolean;
		children: Snippet;
	}

	let { label, scroll = false, children }: Props = $props(); // accessible name, height limit, rows
</script>

<ul class={['list', { scroll }]} aria-label={label}>
	{@render children()}
</ul>

<style>
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}

	.scroll {
		max-height: 22.5rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
