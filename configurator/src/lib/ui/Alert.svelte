<script lang="ts">
	/**
	 * @file Alert.svelte
	 * @brief Shared inline notice on a neutral surface: a tone icon, a title, optional detail, actions and a dismiss button.
	 * @note The danger tone is announced immediately (role="alert"); the others politely (role="status").
	 * @note Actions sit beside the text while there is room and move below it on narrow screens; the dismiss button stays top right.
	 */
	import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		tone?: 'info' | 'ok' | 'warn' | 'danger';
		title: string;
		children?: Snippet;
		actions?: Snippet;
		ondismiss?: () => void;
	}

	let { tone = 'warn', title, children, actions, ondismiss }: Props = $props(); // tone, heading, detail, buttons, close callback
	const ICONS = { info: Info, ok: CircleCheck, warn: TriangleAlert, danger: CircleAlert }; // icon per tone
	const Icon = $derived(ICONS[tone]); // icon for the current tone
</script>

<div class={['alert', tone]} role={tone === 'danger' ? 'alert' : 'status'}>
	<span class="icon" aria-hidden="true"><Icon size={16} /></span>
	<div class="content">
		<div class="body">
			<p class="title">{title}</p>
			{#if children}<div class="detail">{@render children()}</div>{/if}
		</div>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
	{#if ondismiss}
		<Button variant="ghost" size="sm" iconOnly aria-label="Dismiss" title="Dismiss" onclick={ondismiss}>
			<X aria-hidden="true" />
		</Button>
	{/if}
</div>

<style>
	.alert {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}

	.danger {
		border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
	}

	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
	}

	.info .icon {
		background: var(--fill-selected);
		color: var(--text-muted);
	}

	.ok .icon {
		background: var(--ok-subtle);
		color: var(--ok);
	}

	.warn .icon {
		background: var(--warn-subtle);
		color: var(--warn);
	}

	.danger .icon {
		background: var(--danger-subtle);
		color: var(--danger);
	}

	.content {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		min-width: 0;
	}

	.body {
		display: grid;
		flex: 1 1 16rem;
		gap: 2px;
		min-width: 0;
		padding-top: 2px;
	}

	.title {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.detail {
		font-size: var(--text-sm);
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}

	.detail :global(a) {
		color: var(--text);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
