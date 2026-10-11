<script lang="ts" generics="T extends string | number">
	/**
	 * @file SegmentedControl.svelte
	 * @brief Shared single-choice control: a row of segments backed by radio inputs, so arrow keys move the choice; the chosen segment is raised.
	 * @note With iconOnly, each option's label becomes its accessible name and tooltip.
	 * @note Segments share the width equally while they fit, and wrap onto more rows when they do not.
	 */
	import type { LucideIcon } from '@lucide/svelte';

	interface Option {
		value: T;
		label: string;
		icon?: LucideIcon;
	}

	interface Props {
		label: string;
		options: readonly Option[];
		value: T | null;
		layout?: 'stacked' | 'inline';
		size?: 'sm' | 'md';
		hideLabel?: boolean;
		iconOnly?: boolean;
		fill?: boolean;
		disabled?: boolean;
		onchange?: (value: T) => void;
	}

	let {
		label,
		options,
		value,
		layout = 'stacked',
		size = 'md',
		hideLabel = false,
		iconOnly = false,
		fill = false,
		disabled = false,
		onchange
	}: Props = $props(); // choices, current choice, look, commit callback
	const name = $props.id(); // radio group name
</script>

<fieldset class={['segmented', layout, size, { fill }]} {disabled}>
	<legend class="visually-hidden">{label}</legend>
	{#if !hideLabel}<span class="label" aria-hidden="true">{label}</span>{/if}
	<div class="track">
		{#each options as option (option.value)}
			{@const Icon = option.icon}
			<label class={['segment', { selected: option.value === value }]} title={iconOnly ? option.label : undefined}>
				<input
					type="radio"
					{name}
					value={option.value}
					checked={option.value === value}
					aria-label={iconOnly ? option.label : undefined}
					onchange={() => onchange?.(option.value)}
				/>
				{#if Icon}<Icon size={size === 'sm' ? 14 : 16} aria-hidden="true" />{/if}
				{#if !iconOnly}<span>{option.label}</span>{/if}
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.segmented {
		display: grid;
		gap: 6px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.segmented.inline {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
	}

	.label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		user-select: none;
	}

	.track {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		justify-self: start;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-inset);
	}

	.inline .track {
		justify-self: end;
	}

	.fill .track {
		justify-self: stretch;
	}

	.segment {
		position: relative;
		display: inline-flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: max-content;
		height: calc(var(--control-md) - 6px);
		padding: 0 12px;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard),
			color var(--duration-fast) var(--ease-standard);
	}

	.sm .segment {
		height: calc(var(--control-sm) - 6px);
		padding: 0 8px;
		font-size: var(--text-xs);
	}

	.segment:hover:not(.selected) {
		background: var(--fill-hover);
		color: var(--text);
	}

	.segment.selected {
		border-color: var(--border-control);
		background: var(--surface-raised);
		box-shadow: var(--shadow-xs);
		color: var(--text);
	}

	.segment:has(input:focus-visible) {
		z-index: var(--z-focus);
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}

	.segmented:disabled .track {
		opacity: var(--disabled-opacity);
	}

	.segmented:disabled .segment {
		cursor: not-allowed;
	}
</style>
