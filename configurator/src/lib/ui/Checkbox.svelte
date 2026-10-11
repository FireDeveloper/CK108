<script lang="ts">
	/**
	 * @file Checkbox.svelte
	 * @brief Shared checkbox with its label and an optional description; reports the new state on every toggle.
	 */
	import { Check } from '@lucide/svelte';

	interface Props {
		label: string;
		checked: boolean;
		description?: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked, description, disabled = false, onchange }: Props = $props(); // state, label, detail line, commit callback
	const id = $props.id(); // ties the description to the box
</script>

<label class={['checkbox', { disabled }]}>
	<span class="box">
		<input
			type="checkbox"
			{checked}
			{disabled}
			aria-describedby={description ? id : undefined}
			onchange={(event) => onchange?.(event.currentTarget.checked)}
		/>
		<span class="tick" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
	</span>
	<span class="text">
		<span>{label}</span>
		{#if description}<span class="description" {id}>{description}</span>{/if}
	</span>
</label>

<style>
	.checkbox {
		display: inline-grid;
		grid-template-columns: 1rem auto;
		align-items: start;
		column-gap: var(--space-2);
		cursor: pointer;
		user-select: none;
	}

	.checkbox.disabled {
		opacity: var(--disabled-opacity);
		cursor: not-allowed;
	}

	.box {
		position: relative;
		display: grid;
		width: 1rem;
		height: 1rem;
		margin-top: 0.125rem;
	}

	input {
		appearance: none;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-xs);
		background: var(--field);
		cursor: inherit;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard);
	}

	.checkbox:hover input:not(:disabled, :checked) {
		border-color: var(--text-subtle);
	}

	input:checked {
		border-color: var(--accent);
		background: var(--accent);
	}

	.tick {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--accent-text);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--duration-fast) var(--ease-standard);
	}

	input:checked + .tick {
		opacity: 1;
	}

	.text {
		display: grid;
		gap: 2px;
	}

	.description {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
</style>
