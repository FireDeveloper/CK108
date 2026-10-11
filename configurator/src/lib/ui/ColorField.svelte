<script lang="ts">
	/**
	 * @file ColorField.svelte
	 * @brief Shared colour picker drawn as an input with a swatch and the hex value: follows the picker live and reports the colour once, when the picker commits.
	 * @note oninput hears every colour the picker passes through, for live previews; onchange hears only the committed one.
	 */
	interface Props {
		label: string;
		value: string;
		hideLabel?: boolean;
		disabled?: boolean;
		oninput?: (value: string) => void;
		onchange?: (value: string) => void;
	}

	let { label, value, hideLabel = false, disabled = false, oninput, onchange }: Props = $props(); // "#rrggbb" colour, label, live and commit callbacks
	let current = $derived(value); // follows the prop, moves with the picker

	/**
	 * @brief Move with the picker and report the colour it passes through.
	 * @param[in] color "#rrggbb" under the picker.
	 */
	function follow(color: string): void {
		current = color; // swatch and hex follow the picker
		oninput?.(color); // live callback
	}
</script>

<label class={['field', { disabled }]}>
	<span class={['label', { 'visually-hidden': hideLabel }]}>{label}</span>
	<span class="control">
		<input
			type="color"
			{disabled}
			value={current}
			oninput={(event) => follow(event.currentTarget.value)}
			onchange={() => onchange?.(current)}
		/>
		<span class="hex">{current.toUpperCase()}</span>
	</span>
</label>

<style>
	.field {
		display: grid;
		gap: 6px;
		min-width: 0;
		user-select: none;
	}

	.field.disabled {
		opacity: var(--disabled-opacity);
	}

	.label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}

	.control {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: var(--control-md);
		padding: 0 12px 0 5px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--field);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-standard);
	}

	.field:not(.disabled) .control:hover {
		border-color: var(--text-subtle);
	}

	.control:has(input:focus-visible) {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	.disabled .control {
		cursor: not-allowed;
	}

	input {
		appearance: none;
		flex: none;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-xs);
		background: none;
		cursor: inherit;
	}

	input:focus-visible {
		outline: none;
	}

	input::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	input::-webkit-color-swatch {
		border: 0;
		border-radius: var(--radius-xs);
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.45);
	}

	input::-moz-color-swatch {
		border: 0;
		border-radius: var(--radius-xs);
	}

	.hex {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
</style>
