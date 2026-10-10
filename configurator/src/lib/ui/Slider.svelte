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
</script>

<div class="slider">
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
		gap: 6px;
	}

	.head {
		display: flex;
		justify-content: space-between;
	}

	label {
		user-select: none;
	}

	output {
		font-family: var(--font-mono);
		color: var(--text-muted);
	}

	input {
		width: 100%;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}

	input:disabled {
		cursor: not-allowed;
	}

	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
