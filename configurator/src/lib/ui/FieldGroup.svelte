<script lang="ts">
	/**
	 * @file FieldGroup.svelte
	 * @brief Shared group of related controls under one caption, stacked or flowed into a grid.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		hideLabel?: boolean;
		layout?: 'stack' | 'grid';
		children: Snippet;
	}

	let { label, hideLabel = false, layout = 'stack', children }: Props = $props(); // caption, layout, controls
</script>

<fieldset class={['group', layout]}>
	<legend class="visually-hidden">{label}</legend>
	{#if !hideLabel}<span class="label" aria-hidden="true">{label}</span>{/if}
	<div class="items">{@render children()}</div>
</fieldset>

<style>
	.group {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		user-select: none;
	}

	.items {
		display: grid;
		gap: 10px;
	}

	.grid .items {
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 10px var(--space-4);
	}
</style>
