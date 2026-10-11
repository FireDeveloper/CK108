<script lang="ts">
	/**
	 * @file RemapEditor.svelte
	 * @brief Key remap editor: pick a key on a drawing of the keyboard, choose what it sends, and write the active profile's key map.
	 * @note Keys that differ from the factory key map carry a dot and show their new function.
	 * @note The profile switch lives in the app frame; the form follows the picked key into whichever profile the keyboard switched to.
	 */
	import { MousePointerClick, RotateCcw } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import {
		SHORTCUTS,
		decodeAction,
		describeAction,
		keycapText,
		sameAction,
		sameEntry,
		withAction,
		type EditableKind,
		type KeyAction
	} from '#lib/ck108/keymap.ts';
	import { KEYS } from '#lib/ck108/layout.ts';
	import { KEYBOARD_USAGES, MEDIA_USAGES, MODIFIERS } from '#lib/ck108/usages.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FieldGroup from '#lib/ui/FieldGroup.svelte';
	import Hint from '#lib/ui/Hint.svelte';
	import KeyMap from '#lib/ui/KeyMap.svelte';
	import KeyValueList from '#lib/ui/KeyValueList.svelte';
	import SegmentedControl from '#lib/ui/SegmentedControl.svelte';
	import SelectMenu from '#lib/ui/SelectMenu.svelte';

	interface Props {
		profile: number;
		keymap: Uint8Array;
		defaults: Uint8Array;
		macroNames: readonly string[];
	}

	let { profile, keymap, defaults, macroNames }: Props = $props(); // edited profile, its key map, factory key map, stored macros

	const KINDS: { value: EditableKind; label: string }[] = [
		{ value: 'key', label: 'Key' },
		{ value: 'modifiers', label: 'Modifier' },
		{ value: 'media', label: 'Media' },
		{ value: 'shortcut', label: 'Shortcut' },
		{ value: 'macro', label: 'Macro' },
		{ value: 'disabled', label: 'Nothing' }
	]; // action kinds the editor offers
	const KEY_OPTIONS = KEYBOARD_USAGES.map(({ usage, name, group }) => ({ value: usage, label: name, group })); // key picker entries
	const MEDIA_OPTIONS = MEDIA_USAGES.map(({ usage, name, group }) => ({ value: usage, label: name, group })); // media picker entries
	const SHORTCUT_OPTIONS = SHORTCUTS.map((name, index) => ({ value: index, label: name })); // built-in shortcut picker entries

	const connection = getConnection(); // shared connection from the layout
	let slot = $state<number | null>(null); // matrix slot of the picked key
	let kind = $state<KeyAction['kind']>('key'); // kind being composed
	let keyUsage = $state<number | null>(null); // composed key usage
	let mask = $state(0); // composed modifier mask
	let mediaUsage = $state<number | null>(null); // composed media usage
	let shortcutIndex = $state<number | null>(null); // composed built-in shortcut
	let macroIndex = $state<number | null>(null); // composed macro index
	let confirmingReset = $state(false); // Reset every key awaits confirmation

	const macroName = (index: number) => macroNames[index] ?? `#${index + 1} (missing)`; // macro name by index
	const picked = $derived(KEYS.find((key) => key.slot === slot) ?? null); // physical key being edited
	const current = $derived(slot === null ? null : decodeAction(keymap, slot)); // what the picked key does now
	const factory = $derived(slot === null ? null : decodeAction(defaults, slot)); // what it does from the factory
	const keyTitle = $derived(factory ? describeAction(factory, macroName) : ''); // the key's factory function names it, e.g. "Scroll Lock"
	const isChanged = $derived(slot !== null && !sameEntry(keymap, defaults, slot)); // differs from the factory map
	const changedCount = $derived(KEYS.filter((key) => !sameEntry(keymap, defaults, key.slot)).length); // remapped keys in this profile
	const draft = $derived(compose()); // action the form describes, null while incomplete
	const isDraftNew = $derived(draft !== null && current !== null && !sameAction(draft, current)); // assigning would change something
	const mapKeys = $derived(
		KEYS.map((key) => {
			const marked = !sameEntry(keymap, defaults, key.slot); // remapped key
			const action = decodeAction(keymap, key.slot); // what the key sends now
			return {
				...key,
				id: key.slot,
				marked,
				label: marked ? keycapText(action) : key.label,
				detail: marked ? `sends ${describeAction(action, macroName)}` : undefined
			}; // drawn key
		})
	); // keys with their current function
	const macroOptions = $derived(macroNames.map((name, index) => ({ value: index, label: `M${index + 1} ${name}` }))); // macro picker entries

	//? The profile switch lives outside this editor; when the keyboard changes profile, the form reloads the picked key from the new profile's map.
	$effect(() => {
		void profile; // re-run when the active profile changes
		untrack(() => {
			if (slot !== null) load(decodeAction(keymap, slot)); // what the picked key does in that profile
		});
	});

	/**
	 * @brief Pick a key and load its current action into the form.
	 * @param[in] id Matrix slot of the key.
	 */
	function pick(id: number): void {
		slot = id; // edit this key
		load(decodeAction(keymap, id)); // start from what it does now
	}

	/**
	 * @brief Fill the form from an action.
	 * @param[in] action Action to show.
	 */
	function load(action: KeyAction): void {
		kind = action.kind; // shown kind
		keyUsage = action.kind === 'key' ? action.usage : null; // key choice
		mask = action.kind === 'modifiers' ? action.mask : 0; // modifier choice
		mediaUsage = action.kind === 'media' ? action.usage : null; // media choice
		shortcutIndex = action.kind === 'shortcut' ? action.index : null; // shortcut choice
		macroIndex = action.kind === 'macro' ? action.index : null; // macro choice
	}

	/**
	 * @brief Build the action the form describes.
	 * @return The action, or null while a choice is missing.
	 */
	function compose(): KeyAction | null {
		switch (kind) {
			case 'key':
				return keyUsage === null ? null : { kind, usage: keyUsage }; // single key
			case 'modifiers':
				return mask === 0 ? null : { kind, mask }; // at least one modifier
			case 'media':
				return mediaUsage === null ? null : { kind, usage: mediaUsage }; // media key
			case 'shortcut':
				return shortcutIndex === null ? null : { kind, index: shortcutIndex }; // built-in shortcut
			case 'macro':
				return macroIndex === null ? null : { kind, index: macroIndex }; // stored macro
			case 'disabled':
				return { kind }; // nothing
			default:
				return null; // Fn and undecoded entries are not composed here
		}
	}

	/**
	 * @brief Toggle one modifier in the composed mask.
	 * @param[in] bit Modifier bit.
	 * @param[in] on True to include it.
	 */
	function setModifier(bit: number, on: boolean): void {
		mask = on ? mask | bit : mask & ~bit; // set or clear the bit
	}

	/**
	 * @brief Write the picked key's new action.
	 * @param[in] action Action to store.
	 */
	function assign(action: KeyAction): void {
		if (slot === null) return; // no key picked
		load(action); // form shows what is being written
		void connection.applyKeymap(profile, withAction(keymap, slot, action)); // show, write, read back
	}

	/** @brief Put every key of this profile back to its factory action; called once the user confirms. */
	function resetAll(): void {
		confirmingReset = false; // confirmation used
		void connection.applyKeymap(profile, defaults.slice()); // factory map
		if (slot !== null) load(decodeAction(defaults, slot)); // form follows the picked key
	}
</script>

<Card title="Pick a key" description="Keys with a dot differ from the factory layout and show their new function.">
	{#snippet actions()}
		<Button variant="ghost" size="sm" disabled={changedCount === 0} onclick={() => (confirmingReset = true)}>
			<RotateCcw aria-hidden="true" />
			Reset every key
		</Button>
	{/snippet}

	<KeyMap label="Keyboard keys" keys={mapKeys} selected={new Set(slot === null ? [] : [slot])} multiple={false} onselect={pick} />
	<Hint>
		{changedCount === 0
			? `Every key in profile ${profile + 1} sends its factory function.`
			: `${changedCount} ${changedCount === 1 ? 'key differs' : 'keys differ'} from the factory layout in profile ${profile + 1}.`}
	</Hint>
</Card>

{#snippet inspectorFooter()}
	{#if current && factory}
		<Button disabled={!isChanged} onclick={() => assign(factory)}>
			<RotateCcw aria-hidden="true" />
			Reset to factory
		</Button>
		<Button variant="primary" disabled={!draft || !isDraftNew} onclick={() => draft && assign(draft)}>Assign to {keyTitle}</Button>
	{/if}
{/snippet}

<Card title={picked ? `${keyTitle} key` : 'Key'} footer={picked ? inspectorFooter : undefined}>
	{#if !picked || !current || !factory}
		<EmptyState title="No key picked" icon={MousePointerClick}>Pick a key on the keyboard above to see what it sends.</EmptyState>
	{:else}
		<div class="inspector">
			<div class="summary">
				<KeyValueList
					items={[
						{ term: 'Sends now', detail: `${describeAction(current, macroName)}${isChanged ? '' : ' (factory)'}` },
						{ term: 'Factory', detail: describeAction(factory, macroName) }
					]}
				/>
				{#if current.kind === 'fn'}
					<Alert tone="warn" title="This is the Fn key">
						It switches the keyboard's second layer, which holds the media and lighting shortcuts. Remapping it turns those off until you reset this
						key.
					</Alert>
				{/if}
			</div>

			<div class="form">
				<SegmentedControl label="Sends" options={KINDS} value={kind === 'fn' || kind === 'other' ? null : kind} fill onchange={(value) => (kind = value)} />

				{#if kind === 'key'}
					<SelectMenu label="Key" options={KEY_OPTIONS} value={keyUsage} onchange={(value) => (keyUsage = value)} />
				{:else if kind === 'modifiers'}
					<FieldGroup label="Modifiers, held while the key is down" layout="grid">
						{#each MODIFIERS as modifier (modifier.bit)}
							<Checkbox label={modifier.name} checked={(mask & modifier.bit) !== 0} onchange={(on) => setModifier(modifier.bit, on)} />
						{/each}
					</FieldGroup>
				{:else if kind === 'media'}
					<SelectMenu label="Media key" options={MEDIA_OPTIONS} value={mediaUsage} onchange={(value) => (mediaUsage = value)} />
				{:else if kind === 'shortcut'}
					<SelectMenu
						label="Shortcut"
						options={SHORTCUT_OPTIONS}
						value={shortcutIndex}
						description="The keyboard sends these itself. For any other key combination, record a macro."
						onchange={(value) => (shortcutIndex = value)}
					/>
				{:else if kind === 'macro'}
					{#if macroOptions.length > 0}
						<SelectMenu label="Macro" options={macroOptions} value={macroIndex} onchange={(value) => (macroIndex = value)} />
					{:else}
						<Hint>No macros stored yet. Record one under <a href={resolve('/macros')}>Macros</a>.</Hint>
					{/if}
				{:else if kind === 'disabled'}
					<Hint>The key will send nothing.</Hint>
				{/if}
			</div>
		</div>
	{/if}
</Card>

<ConfirmDialog
	open={confirmingReset}
	title="Reset every key in profile {profile + 1}?"
	confirmLabel="Reset keys"
	onconfirm={resetAll}
	oncancel={() => (confirmingReset = false)}
>
	<p>
		{changedCount === 1 ? 'The remapped key goes' : `${changedCount} remapped keys go`} back to their factory function, and the key map is written to the
		keyboard.
	</p>
</ConfirmDialog>

<style>
	.inspector {
		display: grid;
		align-items: start;
		gap: var(--space-6);
	}

	.summary,
	.form {
		display: grid;
		gap: var(--space-4);
	}

	@container content (min-width: 52rem) {
		.inspector {
			grid-template-columns: minmax(0, 32rem) minmax(0, 18rem);
			justify-content: space-between;
		}

		.summary {
			order: 1;
		}
	}
</style>
