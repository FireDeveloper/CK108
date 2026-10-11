<script lang="ts">
	/**
	 * @file TextField.svelte
	 * @brief Shared text or number input with its label, an optional description, and an error message that marks the field invalid; reports every edit.
	 * @note With type="number" the reported value is the text as typed; the caller parses and clamps it.
	 */
	import { CircleAlert } from '@lucide/svelte';

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
		description?: string;
		error?: string;
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
		description,
		error,
		hideLabel = false,
		disabled = false,
		oninput
	}: Props = $props(); // text, constraints, label, help and error text, edit callback
	const id = $props.id(); // ties the message line to the input

	const messageId = $derived(error || description ? `${id}-message` : undefined); // id of the line under the input, if any
</script>

<label class={['field', { disabled, invalid: !!error }]}>
	<span class={['label', { 'visually-hidden': hideLabel }]}>{label}</span>
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
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={messageId}
			oninput={(event) => oninput?.(event.currentTarget.value)}
		/>
		{#if suffix}<span class="suffix">{suffix}</span>{/if}
	</span>
	{#if error}
		<span class="message error" id={messageId}><CircleAlert size={14} aria-hidden="true" />{error}</span>
	{:else if description}
		<span class="message" id={messageId}>{description}</span>
	{/if}
</label>

<style>
	.field {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.field.disabled {
		opacity: var(--disabled-opacity);
	}

	.label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		user-select: none;
	}

	.box {
		display: flex;
		align-items: center;
		height: var(--control-md);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--field);
		transition: border-color var(--duration-fast) var(--ease-standard);
	}

	.field:not(.disabled) .box:hover {
		border-color: var(--text-subtle);
	}

	.box:has(input:focus-visible) {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	.invalid .box,
	.invalid .box:hover {
		border-color: var(--danger);
	}

	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0 10px;
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: var(--text-base);
		outline: none;
	}

	input::placeholder {
		color: var(--text-subtle);
	}

	input:disabled {
		cursor: not-allowed;
	}

	.suffix {
		padding-right: 10px;
		font-size: var(--text-sm);
		color: var(--text-muted);
		user-select: none;
	}

	.message {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.message.error {
		color: var(--danger);
	}

	.message :global(svg) {
		flex: none;
	}
</style>
