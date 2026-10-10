<script lang="ts">
	/**
	 * @file Alert.svelte
	 * @brief Shared inline banner for information, warnings and errors, with optional actions on the right.
	 * @note The danger tone is announced immediately (role="alert"); the others politely (role="status").
	 */
	import { CircleAlert, Info, TriangleAlert } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'info' | 'warn' | 'danger';
		title: string;
		children?: Snippet;
		actions?: Snippet;
	}

	let { tone = 'warn', title, children, actions }: Props = $props(); // colour, heading, detail, buttons
	const ICONS = { info: Info, warn: TriangleAlert, danger: CircleAlert }; // icon per tone
	const Icon = $derived(ICONS[tone]); // icon for the current tone
</script>

<div class={['alert', tone]} role={tone === 'danger' ? 'alert' : 'status'}>
	<Icon size={18} aria-hidden="true" />
	<div class="body">
		<strong>{title}</strong>
		{#if children}<div class="detail">{@render children()}</div>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.alert {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px 14px;
		border-radius: var(--radius);
		border: 1px solid currentColor;
	}

	.alert > :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.body {
		flex: 1;
	}

	.detail {
		color: var(--text);
		margin-top: 2px;
	}

	.actions {
		display: flex;
		gap: 8px;
		align-self: center;
	}

	.info {
		background: var(--info-soft);
		color: var(--accent);
	}

	.warn {
		background: var(--warn-soft);
		color: var(--warn);
	}

	.danger {
		background: var(--danger-soft);
		color: var(--danger);
	}
</style>
