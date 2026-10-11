<script lang="ts">
	/**
	 * @file ListItem.svelte
	 * @brief Shared row of a List: plain content, or a full-width button when the row opens something, with optional actions beside it.
	 * @note Actions sit outside the row button, so no control is nested inside another; the current row carries a bar on its left edge.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		current?: boolean;
		expanded?: boolean;
		onclick?: () => void;
		children: Snippet;
		actions?: Snippet;
	}

	let { current = false, expanded, onclick, children, actions }: Props = $props(); // state, open callback, content, buttons
</script>

<li class={['item', { current }]}>
	{#if onclick}
		<button type="button" class="main" aria-expanded={expanded} {onclick}>{@render children()}</button>
	{:else}
		<div class="main">{@render children()}</div>
	{/if}
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</li>

<style>
	.item {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
	}

	.item:not(:first-child) {
		border-top: 1px solid var(--border);
	}

	.item:first-child {
		border-radius: calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px) 0 0;
	}

	.item:last-child {
		border-bottom-right-radius: calc(var(--radius-md) - 1px);
		border-bottom-left-radius: calc(var(--radius-md) - 1px);
	}

	.current {
		background: var(--fill-selected);
	}

	.current::before {
		content: '';
		position: absolute;
		top: 8px;
		bottom: 8px;
		left: 0;
		width: 3px;
		border-radius: 0 var(--radius-full) var(--radius-full) 0;
		background: var(--text);
	}

	.main {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		text-align: left;
	}

	button.main {
		align-self: stretch;
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--ease-standard);
	}

	button.main:hover {
		background: var(--fill-hover);
	}

	.actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--space-1);
		padding-right: var(--space-2);
	}
</style>
