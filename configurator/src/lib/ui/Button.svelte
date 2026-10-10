<script lang="ts">
	/**
	 * @file Button.svelte
	 * @brief Shared button in primary, secondary and ghost variants; extra attributes pass through to the element.
	 */
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost';
		children: Snippet;
	}

	let { variant = 'secondary', type = 'button', children, ...rest }: Props = $props(); // variant and pass-through attributes
</script>

<button {type} class={['button', variant]} {...rest}>
	{@render children()}
</button>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border: 1px solid transparent;
		border-radius: var(--radius-small);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		user-select: none;
		transition:
			background-color 120ms,
			border-color 120ms,
			color 120ms;
	}

	.button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.primary {
		background: var(--accent);
		color: var(--accent-text);
	}

	.primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.secondary {
		background: var(--surface-raised);
		border-color: var(--border);
		color: var(--text);
	}

	.secondary:hover:not(:disabled) {
		border-color: var(--text-muted);
	}

	.ghost {
		background: transparent;
		color: var(--text-muted);
	}

	.ghost:hover:not(:disabled) {
		color: var(--text);
		background: var(--surface-raised);
	}
</style>
