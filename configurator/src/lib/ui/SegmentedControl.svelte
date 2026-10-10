<script lang="ts" generics="T extends string | number">
	/**
	 * @file SegmentedControl.svelte
	 * @brief Shared single-choice control: a row of segments backed by radio inputs, so arrow keys move the choice.
	 */
	interface Props {
		label: string;
		options: { value: T; label: string }[];
		value: T | null;
		disabled?: boolean;
		onchange?: (value: T) => void;
	}

	let { label, options, value, disabled = false, onchange }: Props = $props(); // choices, current choice, commit callback
	const name = $props.id(); // radio group name
</script>

<fieldset class="segmented" {disabled}>
	<legend>{label}</legend>
	<div class="options">
		{#each options as option (option.value)}
			<label class={{ selected: option.value === value }}>
				<input type="radio" {name} value={option.value} checked={option.value === value} onchange={() => onchange?.(option.value)} />
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.segmented {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		float: left;
		padding: 0;
		user-select: none;
	}

	.options {
		display: inline-flex;
		padding: 3px;
		border-radius: var(--radius-small);
		background: var(--surface-raised);
		border: 1px solid var(--border);
	}

	label {
		padding: 4px 12px;
		border-radius: 4px;
		cursor: pointer;
		user-select: none;
		color: var(--text-muted);
	}

	label.selected {
		background: var(--accent);
		color: var(--accent-text);
	}

	label:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.segmented:disabled label {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
