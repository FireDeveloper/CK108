<script lang="ts">
	/**
	 * @file SwatchPicker.svelte
	 * @brief Shared row of preset colour chips backed by radio inputs, so arrow keys move the choice.
	 */
	interface Props {
		label: string;
		colors: readonly { value: string; name: string }[];
		value: string;
		onchange?: (value: string) => void;
	}

	let { label, colors, value, onchange }: Props = $props(); // preset "#rrggbb" colours, current colour, commit callback
	const name = $props.id(); // radio group name
</script>

<fieldset class="swatches">
	<legend>{label}</legend>
	{#each colors as color (color.value)}
		<label class={['chip', { selected: color.value.toLowerCase() === value.toLowerCase() }]} style:--chip={color.value} title={color.name}>
			<input type="radio" {name} value={color.value} checked={color.value.toLowerCase() === value.toLowerCase()} aria-label={color.name} onchange={() => onchange?.(color.value)} />
		</label>
	{/each}
</fieldset>

<style>
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.chip {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--chip);
		border: 1px solid var(--border);
		cursor: pointer;
	}

	.chip.selected {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.chip:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
</style>
