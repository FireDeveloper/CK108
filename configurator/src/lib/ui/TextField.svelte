<script lang="ts">
	/**
	 * @file TextField.svelte
	 * @brief Shared text or number input with its label; reports every edit.
	 * @note With type="number" the reported value is the text as typed; the caller parses and clamps it.
	 */
	interface Props {
		label: string;
		value: string;
		type?: 'text' | 'number';
		min?: number;
		max?: number;
		step?: number;
		maxlength?: number;
		placeholder?: string;
		suffix?: string;
		hideLabel?: boolean;
		disabled?: boolean;
		oninput?: (value: string) => void;
	}

	let {
		label,
		value,
		type = 'text',
		min,
		max,
		step,
		maxlength,
		placeholder,
		suffix,
		hideLabel = false,
		disabled = false,
		oninput
	}: Props = $props(); // text, constraints, label, edit callback
</script>

<label class={['field', { disabled }]}>
	<span class={{ hidden: hideLabel }}>{label}</span>
	<span class="box">
		<input
			{type}
			{value}
			{min}
			{max}
			{step}
			{maxlength}
			{placeholder}
			{disabled}
			oninput={(event) => oninput?.(event.currentTarget.value)}
		/>
		{#if suffix}<span class="suffix">{suffix}</span>{/if}
	</span>
</label>

<style>
	.field {
		display: grid;
		gap: 6px;
	}

	.field.disabled {
		opacity: 0.5;
	}

	.hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.box {
		display: flex;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius-small);
		background: var(--surface-raised);
	}

	.box:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 7px 10px;
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		outline: none;
	}

	.suffix {
		padding-right: 10px;
		color: var(--text-muted);
		font-size: 13px;
	}
</style>
