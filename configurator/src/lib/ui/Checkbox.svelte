<script lang="ts">
	/**
	 * @file Checkbox.svelte
	 * @brief Shared checkbox with its label; reports the new state on every toggle.
	 */
	interface Props {
		label: string;
		checked: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked, disabled = false, onchange }: Props = $props(); // state, label, commit callback
</script>

<label class={['checkbox', { disabled }]}>
	<input type="checkbox" {checked} {disabled} onchange={(event) => onchange?.(event.currentTarget.checked)} />
	{label}
</label>

<style>
	.checkbox {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
	}

	.checkbox.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input {
		width: 16px;
		height: 16px;
		margin: 0;
		accent-color: var(--accent);
		cursor: inherit;
	}

	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
