<script lang="ts">
	/**
	 * @file Card.svelte
	 * @brief Shared panel with an optional title and header actions.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, actions, children }: Props = $props(); // heading, header actions, body
</script>

<section class="card">
	{#if title || actions}
		<header>
			{#if title}<h2>{title}</h2>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	{@render children()}
</section>

<style>
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space);
	}

	/* Fixed height: header actions overflow it evenly into the card padding, so every title sits on the same line across cards. */
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 20px;
		margin-bottom: 14px;
	}

	h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		gap: 8px;
		margin-right: -8px;
	}
</style>
