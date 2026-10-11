<script lang="ts">
	/**
	 * @file SwatchPicker.svelte
	 * @brief Shared row of preset colour chips backed by radio inputs, so arrow keys move the choice; the chosen chip carries a check.
	 */
	import { Check } from '@lucide/svelte';
	import { inkFor } from './ink.ts';

	interface Props {
		label: string;
		colors: readonly { value: string; name: string }[];
		value: string;
		hideLabel?: boolean;
		size?: 'sm' | 'md';
		onchange?: (value: string) => void;
	}

	let { label, colors, value, hideLabel = false, size = 'md', onchange }: Props = $props(); // preset "#rrggbb" colours, current colour, look, commit callback
	const name = $props.id(); // radio group name
</script>

<fieldset class={['swatches', size]}>
	<legend class="visually-hidden">{label}</legend>
	{#if !hideLabel}<span class="label" aria-hidden="true">{label}</span>{/if}
	<div class="chips">
		{#each colors as color (color.value)}
			{@const isSelected = color.value.toLowerCase() === value.toLowerCase()}
			<label class={['chip', { selected: isSelected }]} style:--chip={color.value} style:--ink={inkFor(color.value)} title={color.name}>
				<input type="radio" {name} value={color.value} checked={isSelected} aria-label={color.name} onchange={() => onchange?.(color.value)} />
				{#if isSelected}<Check size={size === 'sm' ? 12 : 14} strokeWidth={3} aria-hidden="true" />{/if}
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.swatches {
		display: grid;
		gap: 6px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		user-select: none;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: 4px 0;
	}

	.chip {
		position: relative;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		background: var(--chip);
		color: var(--ink);
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.5);
		cursor: pointer;
		transition: scale var(--duration-fast) var(--ease-standard);
	}

	.sm .chip {
		width: 24px;
		height: 24px;
	}

	.chip:hover {
		scale: 1.08;
	}

	.chip:has(input:focus-visible) {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
	}
</style>
