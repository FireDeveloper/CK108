<script lang="ts" generics="T extends string | number">
	/**
	 * @file SelectMenu.svelte
	 * @brief Shared drop-down choice built on a native select, with optional option groups and a description line.
	 * @note Options sharing a group are listed under that group's heading, in the order the groups first appear.
	 */
	import { ChevronDown } from '@lucide/svelte';

	interface Option {
		value: T;
		label: string;
		group?: string;
	}

	interface Props {
		label: string;
		options: readonly Option[];
		value: T | null;
		placeholder?: string;
		description?: string;
		hideLabel?: boolean;
		disabled?: boolean;
		onchange?: (value: T) => void;
	}

	let { label, options, value, placeholder = 'Choose...', description, hideLabel = false, disabled = false, onchange }: Props = $props(); // choices, current choice, commit callback
	const id = $props.id(); // ties the description to the select

	const groups = $derived.by(() => {
		const byName = new Map<string, Option[]>(); // group name -> its options, insertion ordered
		for (const option of options) {
			const name = option.group ?? ''; // ungrouped options share the empty name
			byName.set(name, [...(byName.get(name) ?? []), option]); // append to its group
		}
		return [...byName].map(([name, members]) => ({ name, members })); // groups in first-seen order
	}); // options split by group
	const selectedIndex = $derived(options.findIndex((option) => option.value === value)); // position of the current choice, -1 for none
</script>

<label class={['field', { disabled }]}>
	<span class={['label', { 'visually-hidden': hideLabel }]}>{label}</span>
	<span class="control">
		<select
			class={{ placeholder: selectedIndex < 0 }}
			{disabled}
			aria-describedby={description ? id : undefined}
			value={selectedIndex < 0 ? '' : String(selectedIndex)}
			onchange={(event) => onchange?.(options[Number(event.currentTarget.value)].value)}
		>
			{#if selectedIndex < 0}
				<option value="" disabled>{placeholder}</option>
			{/if}
			{#each groups as group (group.name)}
				{#if group.name}
					<optgroup label={group.name}>
						{#each group.members as option (option.value)}
							<option value={String(options.indexOf(option))}>{option.label}</option>
						{/each}
					</optgroup>
				{:else}
					{#each group.members as option (option.value)}
						<option value={String(options.indexOf(option))}>{option.label}</option>
					{/each}
				{/if}
			{/each}
		</select>
		<span class="chevron" aria-hidden="true"><ChevronDown size={16} /></span>
	</span>
	{#if description}<span class="description" {id}>{description}</span>{/if}
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

	.control {
		position: relative;
		display: block;
	}

	select {
		appearance: none;
		width: 100%;
		height: var(--control-md);
		padding: 0 32px 0 10px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--field);
		color: var(--text);
		font: inherit;
		font-size: var(--text-base);
		text-overflow: ellipsis;
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-standard);
	}

	select:hover:not(:disabled) {
		border-color: var(--text-subtle);
	}

	select:disabled {
		cursor: not-allowed;
	}

	select.placeholder {
		color: var(--text-subtle);
	}

	option,
	optgroup {
		color: var(--text);
		background: var(--surface);
	}

	.chevron {
		position: absolute;
		top: 50%;
		right: 10px;
		display: grid;
		color: var(--text-muted);
		translate: 0 -50%;
		pointer-events: none;
	}

	.description {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
</style>
