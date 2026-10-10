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
	{label}
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
		opacity: 0.5;
		cursor: not-allowed;
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.track {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: 999px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		transition: background-color 120ms;
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--text-muted);
		transition: transform 120ms;
	}

	input:checked + .track {
		background: var(--accent);
		border-color: var(--accent);
	}

	input:checked + .track .thumb {
		transform: translateX(16px);
		background: var(--accent-text);
	}

	input:focus-visible + .track {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
