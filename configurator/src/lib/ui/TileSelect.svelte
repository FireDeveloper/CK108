<script lang="ts" generics="T extends string | number">
	/**
	 * @file TileSelect.svelte
	 * @brief Shared single-choice grid of tiles backed by radio inputs, so arrow keys move the choice.
	 * @note The label is announced but not drawn; the surrounding Card title is the visible heading.
	 */
	interface Props {
		label: string;
		options: { value: T; label: string; badge?: string; disabled?: boolean }[];
		value: T | null;
		onchange?: (value: T) => void;
	}

	let { label, options, value, onchange }: Props = $props(); // choices, current choice, commit callback
	const name = $props.id(); // radio group name
</script>

<fieldset class="tiles">
	<legend>{label}</legend>
	<div class="grid">
		{#each options as option (option.value)}
			<label class={['tile', { selected: option.value === value, disabled: option.disabled }]}>
				<input
					type="radio"
					{name}
					value={option.value}
					checked={option.value === value}
					disabled={option.disabled}
					onchange={() => onchange?.(option.value)}
				/>
				{#if option.badge}<span class="badge">{option.badge}</span>{/if}
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.tiles {
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 6px;
	}

	.tile {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		border-radius: var(--radius-small);
		border: 1px solid transparent;
		background: var(--surface-raised);
		cursor: pointer;
		user-select: none;
		transition: border-color 120ms;
	}

	.tile:hover:not(.disabled) {
		border-color: var(--border);
	}

	.tile.selected {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.tile.disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.tile:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.badge {
		min-width: 2ch;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
