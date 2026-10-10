<script lang="ts" generics="T extends string | number">
	/**
	 * @file SelectMenu.svelte
	 * @brief Shared drop-down choice built on a native select, with optional option groups.
	 * @note Options sharing a group are listed under that group's heading, in the order the groups first appear.
	 */
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
		hideLabel?: boolean;
		disabled?: boolean;
		onchange?: (value: T) => void;
	}

	let { label, options, value, placeholder = 'Choose...', hideLabel = false, disabled = false, onchange }: Props = $props(); // choices, current choice, commit callback

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
	<span class={{ hidden: hideLabel }}>{label}</span>
	<select
		{disabled}
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
</label>

<style>
	.field {
		display: grid;
		gap: 6px;
		user-select: none;
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

	select {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-small);
		background: var(--surface-raised);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	select:disabled {
		cursor: not-allowed;
	}

	select:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
