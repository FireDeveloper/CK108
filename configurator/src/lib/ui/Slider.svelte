<script lang="ts">
	/**
	 * @file Slider.svelte
	 * @brief Shared labelled range slider: shows the value while dragging and reports it once, on release.
	 */
	interface Props {
		label: string;
		value: number;
		min?: number;
		max: number;
		step?: number;
		minLabel?: string;
		maxLabel?: string;
		disabled?: boolean;
		onchange?: (value: number) => void;
	}

	let { label, value, min = 0, max, step = 1, minLabel, maxLabel, disabled = false, onchange }: Props = $props(); // range, labels, commit callback
	const id = $props.id(); // pairs the label with the input
	let current = $derived(value); // follows the prop, moves with the thumb while dragging
	const filled = $derived(max > min ? ((current - min) / (max - min)) * 100 : 0); // filled share of the track, percent
</script>

<div class={['slider', { disabled }]}>
	<div class="head">
		<label for={id}>{label}</label>
		<output for={id}>{current}</output>
	</div>
	<input
		{id}
		type="range"
		{min}
		{max}
		{step}
		{disabled}
		value={current}
		style:--fill="{filled}%"
		oninput={(event) => (current = event.currentTarget.valueAsNumber)}
		onchange={() => onchange?.(current)}
	/>
	{#if minLabel || maxLabel}
		<div class="ends" aria-hidden="true">
			<span>{minLabel}</span>
			<span>{maxLabel}</span>
		</div>
	{/if}
</div>

<style>
	.slider {
		display: grid;
		gap: var(--space-2);
	}

	.slider.disabled {
		opacity: var(--disabled-opacity);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		font-size: var(--text-sm);
	}

	label {
		font-weight: var(--weight-medium);
		user-select: none;
	}

	output {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	input {
		appearance: none;
		width: 100%;
		height: 20px;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}

	input:disabled {
		cursor: not-allowed;
	}

	input:focus-visible {
		outline: none;
	}

	input::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: var(--radius-full);
		background: linear-gradient(to right, var(--accent) var(--fill), var(--border-strong) var(--fill));
	}

	input::-moz-range-track {
		height: 4px;
		border-radius: var(--radius-full);
		background: var(--border-strong);
	}

	input::-moz-range-progress {
		height: 4px;
		border-radius: var(--radius-full);
		background: var(--accent);
	}

	input::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		margin-top: -6px;
		border: 2px solid var(--surface);
		border-radius: var(--radius-full);
		background: var(--accent);
		box-shadow: var(--shadow-xs);
		transition: box-shadow var(--duration-fast) var(--ease-standard);
	}

	input::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border: 2px solid var(--surface);
		border-radius: var(--radius-full);
		background: var(--accent);
	}

	input:hover:not(:disabled)::-webkit-slider-thumb {
		box-shadow: 0 0 0 4px var(--fill-hover);
	}

	input:active:not(:disabled)::-webkit-slider-thumb {
		box-shadow: 0 0 0 6px var(--fill-selected);
	}

	input:focus-visible::-webkit-slider-thumb {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	input:focus-visible::-moz-range-thumb {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	.ends {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
