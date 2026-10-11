<script lang="ts">
	/**
	 * @file EmptyState.svelte
	 * @brief Shared placeholder for an empty or loading area: an icon or spinner, a title, a description and optional actions.
	 * @note A busy state is announced as a status; the large size suits a whole-screen message.
	 */
	import type { LucideIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		title: string;
		icon?: LucideIcon;
		heading?: 'h1' | 'h2' | 'h3' | 'p';
		size?: 'sm' | 'lg';
		busy?: boolean;
		children?: Snippet;
		actions?: Snippet;
	}

	let { title, icon: Icon, heading = 'h3', size = 'sm', busy = false, children, actions }: Props = $props(); // text, mark, heading level, scale, activity, description, buttons
</script>

<div class={['empty', size]} role={busy ? 'status' : undefined}>
	{#if busy}
		<span class="mark"><Spinner size={size === 'lg' ? 24 : 18} /></span>
	{:else if Icon}
		<span class="mark" aria-hidden="true"><Icon size={size === 'lg' ? 26 : 18} /></span>
	{/if}
	<svelte:element this={heading} class="title">{title}</svelte:element>
	{#if children}<div class="description">{@render children()}</div>{/if}
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		padding: var(--space-8) var(--space-4);
		text-align: center;
	}

	.lg {
		gap: var(--space-3);
		padding: var(--space-6) 0;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		margin-bottom: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-muted);
		box-shadow: var(--shadow-xs);
	}

	.lg .mark {
		width: 56px;
		height: 56px;
		margin-bottom: var(--space-2);
		border-radius: var(--radius-lg);
	}

	.title {
		margin: 0;
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		line-height: var(--leading-tight);
	}

	.lg .title {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-tight);
	}

	.description {
		max-width: 44ch;
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-wrap: pretty;
	}

	.lg .description {
		max-width: 52ch;
		font-size: var(--text-base);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
</style>
