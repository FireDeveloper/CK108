<script lang="ts">
	/**
	 * @file KeyValueList.svelte
	 * @brief Shared list of labelled values: muted terms on the left, their values on the right.
	 */
	interface Item {
		term: string;
		detail: string;
		mono?: boolean;
	}

	interface Props {
		items: readonly Item[];
	}

	let { items }: Props = $props(); // rows in order; mono sets the value in the code font
</script>

<dl class="list">
	{#each items as item (item.term)}
		<dt>{item.term}</dt>
		<dd class={{ mono: item.mono }}>{item.detail}</dd>
	{/each}
</dl>

<style>
	.list {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 6px var(--space-4);
		margin: 0;
		font-size: var(--text-sm);
	}

	dt {
		color: var(--text-muted);
	}

	dd {
		margin: 0;
		font-weight: var(--weight-medium);
		overflow-wrap: anywhere;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
