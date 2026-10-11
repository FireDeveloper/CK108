<script lang="ts" generics="T extends string | number">
	/**
	 * @file TileSelect.svelte
	 * @brief Shared single-choice grid of tiles backed by radio inputs, so arrow keys move the choice; the chosen tile is outlined and checked.
	 * @note The label is announced but not drawn; the surrounding Card title is the visible heading.
	 */
	import { Check } from '@lucide/svelte';

	interface Props {
		label: string;
		options: readonly { value: T; label: string; description?: string; disabled?: boolean }[];
		value: T | null;
		onchange?: (value: T) => void;
	}

	let { label, options, value, onchange }: Props = $props(); // choices, current choice, commit callback
	const name = $props.id(); // radio group name
</script>

<fieldset class="tiles">
	<legend class="visually-hidden">{label}</legend>
	<div class="grid">
		{#each options as option (option.value)}
			{@const isSelected = option.value === value}
			<label class={['tile', { selected: isSelected, disabled: option.disabled }]}>
				<input
					type="radio"
					{name}
					value={option.value}
					checked={isSelected}
					disabled={option.disabled}
					onchange={() => onchange?.(option.value)}
				/>
				<span class="mark" aria-hidden="true">
					{#if isSelected}<Check size={10} strokeWidth={4} />{/if}
				</span>
				<span class="text">
					<span class="name">{option.label}</span>
					{#if option.description}<span class="description">{option.description}</span>{/if}
				</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.tiles {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: var(--space-2);
	}

	.tile {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 2.75rem;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		cursor: pointer;
		user-select: none;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard),
			box-shadow var(--duration-fast) var(--ease-standard);
	}

	.tile:hover:not(.disabled, .selected) {
		border-color: var(--border-strong);
		background: var(--fill-hover);
	}

	.tile.selected {
		border-color: var(--text);
		background: var(--fill-selected);
		box-shadow: inset 0 0 0 1px var(--text);
	}

	.tile.disabled {
		opacity: var(--disabled-opacity);
		cursor: not-allowed;
	}

	.tile:has(input:focus-visible) {
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

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 16px;
		height: 16px;
		border: 1.5px solid var(--border-control);
		border-radius: var(--radius-full);
		color: var(--accent-text);
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard);
	}

	.selected .mark {
		border-color: var(--accent);
		background: var(--accent);
	}

	.text {
		display: grid;
		gap: 1px;
		min-width: 0;
	}

	.name {
		line-height: var(--leading-snug);
	}

	.selected .name {
		font-weight: var(--weight-semibold);
	}

	.description {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
