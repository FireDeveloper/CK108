/**
 * @file layout.ts
 * @brief CK108 physical keys: name, keycap text, LED index, key map slot and drawing rectangle, from the shared ck108_layout.json.
 * @note Rectangles are in the vendor UI's pixel space; only their proportions matter.
 */

import table from '../../../../ck108/ck108_layout.json';

//& Public Variables

/** @brief One physical key. */
export interface Key {
	name: string;
	label: string;
	led: number;
	slot: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

//? The vendor rectangles are click targets smaller than the keycaps; the tightest gaps are 6 units across and 4 down, so these margins keep every key apart.
export const GROW_X = 2; // units added on the left and right of each key
export const GROW_Y = 1.5; // units added above and below each key

export const KEYS: readonly Key[] = table.map(({ name, led, slot, x, y, w, h }) => ({
	name, // vendor key name
	label: keycapLabel(name), // keycap text
	led, // per-key colour index
	slot, // key map slot
	x: x - GROW_X, // left edge, widened
	y: y - GROW_Y, // top edge, widened
	w: w + 2 * GROW_X, // width, widened on both sides
	h: h + 2 * GROW_Y // height, widened on both sides
})); // keys as drawn, in LED order

//& Private Functions

/**
 * @brief Keycap text for a vendor key name, shortened where the name does not fit a key.
 * @param[in] name Vendor key name from the layout table.
 * @return Text to draw on the key.
 */
function keycapLabel(name: string): string {
	const short: Readonly<Record<string, string>> = {
		BackSpace: 'Bksp',
		CapsLock: 'Caps',
		Rightshift: 'Shift',
		'Right Ctrl': 'Ctrl',
		'Right Alt': 'Alt',
		PrintScreen: 'PrtSc',
		ScrollLock: 'ScrLk',
		'Pause/Break': 'Pause',
		Insert: 'Ins',
		Delete: 'Del',
		PageUp: 'PgUp',
		PageDown: 'PgDn',
		NumLock: 'Num',
		'Num Enter': 'Ent',
		Up: String.fromCharCode(0x2191), // up arrow
		Down: String.fromCharCode(0x2193), // down arrow
		Left: String.fromCharCode(0x2190), // left arrow
		Right: String.fromCharCode(0x2192) // right arrow
	}; // names that do not fit their key
	return short[name] ?? name.replace(/^Num /, ''); // short form, or the name without the keypad prefix
}
