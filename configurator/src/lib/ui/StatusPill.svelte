<script lang="ts">
	/**
	 * @file StatusPill.svelte
	 * @brief Shared status badge: a tone dot, or a spinner while busy, beside a short label; screen readers hear each change.
	 */
	import Spinner from './Spinner.svelte';

	interface Props {
		tone?: 'neutral' | 'ok' | 'warn' | 'danger';
		label: string;
		busy?: boolean;
	}

	let { tone = 'neutral', label, busy = false }: Props = $props(); // dot colour, text, activity
</script>

<span class={['pill', tone]} role="status">
	{#if busy}
		<Spinner size={12} />
	{:else}
		<span class="dot" aria-hidden="true"></span>
	{/if}
	{label}
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 22px;
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--fill-subtle);
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		white-space: nowrap;
		user-select: none;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--text-subtle);
	}

	.ok .dot {
		background: var(--ok);
	}

	.warn .dot {
		background: var(--warn);
	}

	.danger {
		color: var(--danger);
	}

	.danger .dot {
		background: var(--danger);
	}
</style>
