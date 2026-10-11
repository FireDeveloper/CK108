<script lang="ts">
	/**
	 * @file Card.svelte
	 * @brief Shared panel: an optional header with title, description and actions, a body that stacks its children, and an optional footer for main actions.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		description?: string;
		actions?: Snippet;
		footer?: Snippet;
		children: Snippet;
	}

	let { title, description, actions, footer, children }: Props = $props(); // heading, subheading, header buttons, footer buttons, body
	const id = $props.id(); // labels the section with its heading
</script>

<section class="card" aria-labelledby={title ? id : undefined}>
	{#if title || actions}
		<header>
			{#if title}
				<div class="heading">
					<h2 {id}>{title}</h2>
					{#if description}<p>{description}</p>{/if}
				</div>
			{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class="body">{@render children()}</div>
	{#if footer}<footer>{@render footer()}</footer>{/if}
</section>

<style>
	.card {
		min-width: 0;
		padding: var(--space-5);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin-bottom: var(--space-4);
	}

	.heading {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	h2 {
		font-size: var(--text-md);
		letter-spacing: -0.01em;
	}

	.heading p {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		margin: var(--space-5) calc(-1 * var(--space-5)) calc(-1 * var(--space-5));
		padding: var(--space-3) var(--space-5);
		border-top: 1px solid var(--border);
		border-radius: 0 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px);
		background: var(--fill-subtle);
	}

	@container content (max-width: 40rem) {
		.card {
			padding: var(--space-4);
		}

		footer {
			margin: var(--space-4) calc(-1 * var(--space-4)) calc(-1 * var(--space-4));
			padding: var(--space-3) var(--space-4);
		}
	}
</style>
