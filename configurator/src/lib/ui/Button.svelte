<script lang="ts">
	/**
	 * @file Button.svelte
	 * @brief Shared button in primary, secondary, ghost and danger variants and two sizes; extra attributes pass through to the element.
	 * @note An icon-only button has no visible text, so its type requires an aria-label.
	 */
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		children: Snippet;
	} & ({ iconOnly: true; 'aria-label': string } | { iconOnly?: false });

	let { variant = 'secondary', size = 'md', iconOnly = false, type = 'button', children, ...rest }: Props = $props(); // look, size, pass-through attributes
</script>

<button {type} class={['button', variant, size, { 'icon-only': iconOnly }]} {...rest}>
	{@render children()}
</button>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		height: var(--control-md);
		padding: 0 14px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard),
			color var(--duration-fast) var(--ease-standard),
			translate var(--duration-fast) var(--ease-standard);
	}

	.button :global(svg) {
		flex: none;
		width: 16px;
		height: 16px;
	}

	.sm {
		gap: 6px;
		height: var(--control-sm);
		padding: 0 10px;
		font-size: var(--text-sm);
	}

	.sm :global(svg) {
		width: 14px;
		height: 14px;
	}

	.icon-only {
		width: var(--control-md);
		padding: 0;
	}

	.icon-only.sm {
		width: var(--control-sm);
	}

	.button:active:not(:disabled) {
		translate: 0 1px;
	}

	.button:disabled {
		opacity: var(--disabled-opacity);
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
		border-color: var(--border-strong);
		color: var(--text);
		box-shadow: var(--shadow-xs);
	}

	.secondary:hover:not(:disabled) {
		background: var(--surface-raised-hover);
	}

	.ghost {
		background: transparent;
		color: var(--text-muted);
	}

	.ghost:hover:not(:disabled) {
		background: var(--fill-hover);
		color: var(--text);
	}

	.danger {
		background: var(--danger-solid);
		color: var(--on-danger);
	}

	.danger:hover:not(:disabled) {
		background: var(--danger-solid-hover);
	}
</style>
