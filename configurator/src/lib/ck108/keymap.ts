/**
 * @file keymap.ts
 * @brief CK108 key map: block geometry, the 3-byte entry codec and display names for what a key does.
 * @note A profile's key map holds one entry per matrix slot, slot = column x 6 + row; layout.ts gives each physical key its slot.
 */

import { keyName, keyShort, mediaName, mediaShort, modifierNames } from './usages.ts';

//& Public Variables

export const PROFILES = 3; // hardware profile slots
export const KEYMAP_SLOTS = 126; // matrix positions, 21 columns x 6 rows
export const ENTRY_SIZE = 3; // bytes per key map entry
export const KEYMAP_SIZE = KEYMAP_SLOTS * ENTRY_SIZE; // bytes per profile key map, 0x17A

/** @brief What one key does, decoded from its key map entry. */
export type KeyAction =
	| { kind: 'key'; usage: number } // one keyboard usage
	| { kind: 'modifiers'; mask: number } // modifier keys, OR of Modifier bits
	| { kind: 'media'; usage: number } // one consumer usage
	| { kind: 'macro'; index: number } // play a stored macro, 0-based
	| { kind: 'shortcut'; index: number } // a built-in edit shortcut, index into SHORTCUTS
	| { kind: 'fn' } // the Fn layer key
	| { kind: 'disabled' } // nothing
	| { kind: 'other'; entry: readonly number[] }; // an entry the configurator does not decode, kept as its bytes

/** @brief Kinds of action the key editor offers. */
export type EditableKind = Exclude<KeyAction['kind'], 'other'>;

export const SHORTCUTS = ['Open', 'New', 'Undo', 'Save', 'Copy', 'Cut', 'Paste', 'Find', 'Select all', 'Zoom out', 'Zoom in']; // built-in edit shortcuts, by firmware index

//& Private Variables

const TYPE_KEYBOARD = 0x02; // entry byte 0: keyboard page
const TYPE_MEDIA = 0x03; // entry byte 0: consumer page, usage u16 LE in bytes 1..2
const TYPE_FUNCTION = 0x05; // entry byte 0: firmware function
const KEYBOARD_MODIFIERS = 0x01; // keyboard entry byte 1: byte 2 is a modifier mask
const KEYBOARD_KEY = 0x02; // keyboard entry byte 1: byte 2 is a usage
const FUNCTION_MACRO = 0x01; // function entry byte 1: byte 2 is a macro index
const FUNCTION_SHORTCUT = 0x05; // function entry byte 1: byte 2 is a SHORTCUTS index
const FUNCTION_FN = [TYPE_FUNCTION, 0x02, 0x02]; // the Fn key entry

//& Public Functions

/**
 * @brief Decode the entry of one matrix slot.
 * @param[in] map KEYMAP_SIZE bytes of one profile.
 * @param[in] slot Matrix slot, 0..KEYMAP_SLOTS-1.
 * @return The key's action.
 */
export function decodeAction(map: Uint8Array, slot: number): KeyAction {
	const [type, sub, value] = map.subarray(slot * ENTRY_SIZE, slot * ENTRY_SIZE + ENTRY_SIZE); // entry bytes

	//- Keyboard page
	if (type === TYPE_KEYBOARD && sub === KEYBOARD_KEY) return { kind: 'key', usage: value }; // single key
	if (type === TYPE_KEYBOARD && sub === KEYBOARD_MODIFIERS) return { kind: 'modifiers', mask: value }; // modifier mask
	if ((type === 0 || type === TYPE_KEYBOARD) && sub === 0) return { kind: 'disabled' }; // disabled key or empty matrix position

	//- Consumer page and firmware functions
	if (type === TYPE_MEDIA) return { kind: 'media', usage: sub | (value << 8) }; // consumer usage, u16 LE
	if (type === TYPE_FUNCTION && sub === FUNCTION_MACRO) return { kind: 'macro', index: value }; // macro reference
	if (type === TYPE_FUNCTION && sub === FUNCTION_SHORTCUT && value < SHORTCUTS.length) return { kind: 'shortcut', index: value }; // built-in shortcut
	if (type === FUNCTION_FN[0] && sub === FUNCTION_FN[1] && value === FUNCTION_FN[2]) return { kind: 'fn' }; // Fn key
	return { kind: 'other', entry: [type, sub, value] }; // keep unknown entries as they are
}

/**
 * @brief Encode an action as a key map entry.
 * @param[in] action The key's new action.
 * @return ENTRY_SIZE bytes.
 */
export function encodeAction(action: KeyAction): Uint8Array<ArrayBuffer> {
	switch (action.kind) {
		case 'key':
			return Uint8Array.of(TYPE_KEYBOARD, KEYBOARD_KEY, action.usage); // single key
		case 'modifiers':
			return Uint8Array.of(TYPE_KEYBOARD, KEYBOARD_MODIFIERS, action.mask); // modifier mask
		case 'media':
			return Uint8Array.of(TYPE_MEDIA, action.usage & 0xff, action.usage >> 8); // consumer usage, u16 LE
		case 'macro':
			return Uint8Array.of(TYPE_FUNCTION, FUNCTION_MACRO, action.index); // macro reference
		case 'shortcut':
			return Uint8Array.of(TYPE_FUNCTION, FUNCTION_SHORTCUT, action.index); // built-in shortcut
		case 'fn':
			return Uint8Array.from(FUNCTION_FN); // Fn key
		case 'disabled':
			return new Uint8Array(ENTRY_SIZE); // all zero
		case 'other':
			return Uint8Array.from(action.entry); // bytes as read
	}
}

/**
 * @brief Copy a key map with one slot changed.
 * @param[in] map KEYMAP_SIZE bytes of one profile.
 * @param[in] slot Matrix slot to change.
 * @param[in] action The slot's new action.
 * @return The changed copy; map itself is untouched.
 */
export function withAction(map: Uint8Array, slot: number, action: KeyAction): Uint8Array<ArrayBuffer> {
	const next = Uint8Array.from(map); // edit a copy
	next.set(encodeAction(action), slot * ENTRY_SIZE); // new entry
	return next; // changed map
}

/**
 * @brief Copy a key map with the references to one macro removed and later macro numbers shifted down.
 * @param[in] map KEYMAP_SIZE bytes of one profile.
 * @param[in] defaults Factory key map; keys that played the removed macro get their factory entry back.
 * @param[in] removed 0-based index of the macro being deleted.
 * @return The adjusted copy; map itself is untouched.
 */
export function withoutMacro(map: Uint8Array, defaults: Uint8Array, removed: number): Uint8Array<ArrayBuffer> {
	const next = Uint8Array.from(map); // edit a copy
	for (let slot = 0; slot < KEYMAP_SLOTS; slot++) { // every matrix position
		const action = decodeAction(map, slot); // what the slot does now
		if (action.kind !== 'macro' || action.index < removed) continue; // unaffected
		const start = slot * ENTRY_SIZE; // first entry byte
		if (action.index === removed) next.set(defaults.subarray(start, start + ENTRY_SIZE), start); // factory entry back
		else next[start + 2] = action.index - 1; // follow the macro down one place
	}
	return next; // adjusted map
}

/**
 * @brief Compare the entries of one slot in two key maps.
 * @param[in] a KEYMAP_SIZE bytes.
 * @param[in] b KEYMAP_SIZE bytes.
 * @param[in] slot Matrix slot.
 * @return True when both maps hold the same entry bytes.
 */
export function sameEntry(a: Uint8Array, b: Uint8Array, slot: number): boolean {
	const start = slot * ENTRY_SIZE; // first entry byte
	return a[start] === b[start] && a[start + 1] === b[start + 1] && a[start + 2] === b[start + 2]; // byte by byte
}

/**
 * @brief Compare two actions by the entry bytes they encode to.
 * @param[in] a First action.
 * @param[in] b Second action.
 * @return True when both store the same entry.
 */
export function sameAction(a: KeyAction, b: KeyAction): boolean {
	const [x, y] = [encodeAction(a), encodeAction(b)]; // entry bytes of each
	return x.every((byte, index) => byte === y[index]); // byte by byte
}

/**
 * @brief Describe an action for display.
 * @param[in] action Decoded action.
 * @param[in] macroName Name of a macro by index, for macro actions.
 * @return Readable description, e.g. "Left Ctrl", "Volume up", "Macro: Copy".
 */
export function describeAction(action: KeyAction, macroName: (index: number) => string = (index) => `#${index + 1}`): string {
	switch (action.kind) {
		case 'key':
			return keyName(action.usage); // key name
		case 'modifiers':
			return modifierNames(action.mask) || 'No modifier'; // modifier names
		case 'media':
			return mediaName(action.usage); // media name
		case 'macro':
			return `Macro: ${macroName(action.index)}`; // macro name
		case 'shortcut':
			return SHORTCUTS[action.index]; // shortcut name
		case 'fn':
			return 'Fn'; // Fn layer
		case 'disabled':
			return 'Disabled'; // nothing
		case 'other':
			return action.entry.map((byte) => byte.toString(16).padStart(2, '0')).join(' '); // raw bytes
	}
}

/**
 * @brief Keycap text for an action, short enough for a key in the keyboard drawing.
 * @param[in] action Decoded action.
 * @return Short text, e.g. "Ctrl", "Vol+", "M2".
 */
export function keycapText(action: KeyAction): string {
	switch (action.kind) {
		case 'key':
			return keyShort(action.usage); // key keycap
		case 'modifiers':
			return modifierNames(action.mask, true) || 'None'; // modifier keycaps
		case 'media':
			return mediaShort(action.usage); // media keycap
		case 'macro':
			return `M${action.index + 1}`; // macro number, counted from 1
		case 'shortcut':
			return SHORTCUTS[action.index]; // shortcut name
		case 'fn':
			return 'Fn'; // Fn layer
		case 'disabled':
			return 'Off'; // nothing
		case 'other':
			return '?'; // undecoded entry
	}
}
