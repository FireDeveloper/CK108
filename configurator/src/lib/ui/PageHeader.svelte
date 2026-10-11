<script lang="ts">
	/**
	 * @file PageHeader.svelte
	 * @brief Shared page heading: the page title with an optional badge, a one-line description and page actions.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		badge?: string;
		actions?: Snippet;
	}

	let { title, description, badge, actions }: Props = $props(); // heading, subheading, tag, buttons
</script>

<header class="page-header">
	<div class="heading">
		<div class="title-row">
			<h1>{title}</h1>
			{#if badge}<span class="badge">{badge}</span>{/if}
		</div>
		{#if description}<p>{description}</p>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3) var(--space-6);
	}

	.heading {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	h1 {
		font-size: var(--text-xl);
		letter-spacing: var(--tracking-tight);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		height: 22px;
		padding: 0 8px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full);
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		white-space: nowrap;
	}

	p {
		max-width: 65ch;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	@container content (max-width: 40rem) {
		h1 {
			font-size: 1.25rem;
		}
	}
</style>
