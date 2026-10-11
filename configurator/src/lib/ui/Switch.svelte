<script lang="ts">
	/**
	 * @file Switch.svelte
	 * @brief Shared on/off switch built on a checkbox with role="switch".
	 */
	interface Props {
		label: string;
		checked: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked, disabled = false, onchange }: Props = $props(); // state, label, commit callback
</script>

<label class={['switch', { disabled }]}>
	<input type="checkbox" role="switch" {checked} {disabled} onchange={(event) => onchange?.(event.currentTarget.checked)} />
	<span class="track" aria-hidden="true"><span class="thumb"></span></span>
	<span>{label}</span>
</label>

<style>
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		user-select: none;
	}

	.switch.disabled {
		opacity: var(--disabled-opacity);
		cursor: not-allowed;
	}

	input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
	}

	.track {
		position: relative;
		flex: none;
		width: 32px;
		height: 18px;
		border-radius: var(--radius-full);
		background: var(--border-control);
		transition: background-color var(--duration-base) var(--ease-standard);
	}

	.switch:hover input:not(:checked, :disabled) + .track {
		background: var(--text-subtle);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: var(--radius-full);
		background: var(--gray-0);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
		transition:
			translate var(--duration-base) var(--ease-standard),
			background-color var(--duration-base) var(--ease-standard);
	}

	input:checked + .track {
		background: var(--accent);
	}

	input:checked + .track .thumb {
		translate: 14px 0;
		background: var(--accent-text);
	}

	input:focus-visible + .track {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}
</style>
