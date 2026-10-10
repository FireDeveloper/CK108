<script lang="ts">
	/**
	 * @file RemapEditor.svelte
	 * @brief Key remap editor: switch the active profile, pick a key on a drawing of the keyboard, choose what it sends, and write the profile's key map.
	 * @note Keys that differ from the factory key map are highlighted and show their new function.
	 */
	import { RotateCcw } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import {
		PROFILES,
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
	import KeyMap from '#lib/ui/KeyMap.svelte';
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
	const PROFILE_OPTIONS = Array.from({ length: PROFILES }, (_, index) => ({ value: index, label: `Profile ${index + 1}` })); // profile choices

	const connection = getConnection(); // shared connection from the layout
	let slot = $state<number | null>(null); // matrix slot of the picked key
	let kind = $state<KeyAction['kind']>('key'); // kind being composed
	let keyUsage = $state<number | null>(null); // composed key usage
	let mask = $state(0); // composed modifier mask
	let mediaUsage = $state<number | null>(null); // composed media usage
	let shortcutIndex = $state<number | null>(null); // composed built-in shortcut
	let macroIndex = $state<number | null>(null); // composed macro index
	let switching = $state(false); // profile switch in flight

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
			return { ...key, id: key.slot, marked, label: marked ? keycapText(decodeAction(keymap, key.slot)) : key.label }; // drawn key
		})
	); // keys with their current function
	const macroOptions = $derived(macroNames.map((name, index) => ({ value: index, label: `${index + 1}. ${name}` }))); // macro picker entries

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

	/**
	 * @brief Switch the keyboard to another profile, then reload the picked key's form from that profile's key map.
	 * @param[in] next 0..PROFILES-1.
	 */
	async function switchProfile(next: number): Promise<void> {
		switching = true; // block a second switch
		try {
			await connection.setProfile(next); // switch and read back
		} finally {
			switching = false; // ready again
		}
		if (slot !== null) load(decodeAction(keymap, slot)); // form follows the picked key in the profile now in use
	}

	/** @brief Put every key of this profile back to its factory action. */
	function resetAll(): void {
		void connection.applyKeymap(profile, defaults.slice()); // factory map
		if (slot !== null) load(decodeAction(defaults, slot)); // form follows the picked key
	}
</script>

<Card title="Keys of profile {profile + 1}">
	{#snippet actions()}
		<Button variant="ghost" disabled={changedCount === 0} onclick={resetAll}>
			<RotateCcw size={16} aria-hidden="true" />
			Reset every key
		</Button>
	{/snippet}

	<div class="profile">
		<SegmentedControl label="Active profile" options={PROFILE_OPTIONS} value={profile} disabled={switching} onchange={(value) => void switchProfile(value)} />
	</div>
	<KeyMap label="Keyboard keys" keys={mapKeys} selected={new Set(slot === null ? [] : [slot])} multiple={false} onselect={pick} />
	<p class="hint">
		Pick a key to change what it sends. Highlighted keys differ from the factory layout and show their new function. Switching profile changes
		the keys the keyboard uses at once; lighting and key colours are shared by every profile.
	</p>
</Card>

<Card title={picked ? `${keyTitle} key` : 'Key'}>
	{#if !picked || !current || !factory}
		<p class="hint">No key picked yet.</p>
	{:else}
		<dl>
			<dt>Sends now</dt>
			<dd>{describeAction(current, macroName)}{isChanged ? '' : ' (factory)'}</dd>
			<dt>Factory</dt>
			<dd>{describeAction(factory, macroName)}</dd>
		</dl>

		{#if current.kind === 'fn'}
			<Alert tone="warn" title="This is the Fn key">
				It switches the keyboard's second layer, which holds the media and lighting shortcuts. Remapping it turns those off until you reset
				this key.
			</Alert>
		{/if}

		<div class="form">
			<SegmentedControl label="Sends" options={KINDS} value={kind === 'fn' || kind === 'other' ? null : kind} onchange={(value) => (kind = value)} />

			{#if kind === 'key'}
				<SelectMenu label="Key" options={KEY_OPTIONS} value={keyUsage} onchange={(value) => (keyUsage = value)} />
			{:else if kind === 'modifiers'}
				<fieldset class="modifiers">
					<legend>Modifiers, held while the key is down</legend>
					{#each MODIFIERS as modifier (modifier.bit)}
						<Checkbox label={modifier.name} checked={(mask & modifier.bit) !== 0} onchange={(on) => setModifier(modifier.bit, on)} />
					{/each}
				</fieldset>
			{:else if kind === 'media'}
				<SelectMenu label="Media key" options={MEDIA_OPTIONS} value={mediaUsage} onchange={(value) => (mediaUsage = value)} />
			{:else if kind === 'shortcut'}
				<SelectMenu label="Shortcut" options={SHORTCUT_OPTIONS} value={shortcutIndex} onchange={(value) => (shortcutIndex = value)} />
				<p class="hint">The keyboard sends these itself. For any other key combination, record a macro.</p>
			{:else if kind === 'macro'}
				{#if macroOptions.length > 0}
					<SelectMenu label="Macro" options={macroOptions} value={macroIndex} onchange={(value) => (macroIndex = value)} />
				{:else}
					<p class="hint">No macros stored yet. Record one under <a href={resolve('/macros')}>Macros</a>.</p>
				{/if}
			{:else if kind === 'disabled'}
				<p class="hint">The key will send nothing.</p>
			{/if}
		</div>

		<div class="actions">
			<Button variant="primary" disabled={!draft || !isDraftNew} onclick={() => draft && assign(draft)}>Assign to {keyTitle}</Button>
			<Button disabled={!isChanged} onclick={() => assign(factory)}>
				<RotateCcw size={16} aria-hidden="true" />
				Reset to factory
			</Button>
		</div>
	{/if}
</Card>

<style>
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 20px;
		margin: 0 0 16px;
	}

	dt {
		color: var(--text-muted);
	}

	dd {
		margin: 0;
		font-weight: 600;
	}

	.profile {
		max-width: 520px;
		margin-bottom: 16px;
	}

	.form {
		display: grid;
		gap: 16px;
		max-width: 520px;
		margin-top: 16px;
	}

	.modifiers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px 16px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.modifiers legend {
		margin-bottom: 8px;
		padding: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 20px;
	}

	.hint {
		margin: 12px 0 0;
		font-size: 13px;
		color: var(--text-muted);
	}

	.hint a {
		color: var(--accent);
	}
</style>
