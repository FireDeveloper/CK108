<script lang="ts">
	/**
	 * @file ColorField.svelte
	 * @brief Shared colour picker with its hex value: follows the picker live and reports the colour once, when the picker commits.
	 */
	interface Props {
		label: string;
		value: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let { label, value, disabled = false, onchange }: Props = $props(); // "#rrggbb" colour, label, commit callback
	let current = $derived(value); // follows the prop, moves with the picker
</script>

<label class={['field', { disabled }]}>
	<span>{label}</span>
	<span class="picker">
		<input
			type="color"
			{disabled}
			value={current}
			oninput={(event) => (current = event.currentTarget.value)}
			onchange={() => onchange?.(current)}
		/>
		<span class="hex">{current.toUpperCase()}</span>
	</span>
</label>

<style>
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		user-select: none;
	}

	.field.disabled {
		opacity: 0.5;
	}

	.picker {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}

	input {
		width: 40px;
		height: 28px;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-small);
		background: var(--surface-raised);
		cursor: pointer;
	}

	input:disabled {
		cursor: not-allowed;
	}

	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.hex {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
