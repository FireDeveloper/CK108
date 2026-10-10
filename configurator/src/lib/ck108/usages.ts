/**
 * @file usages.ts
 * @brief HID usages the CK108 can send, with names and picker groups: keyboard keys, modifier bits, media (consumer) keys and system power keys.
 * @note The keyboard usage range stops at 0x70 (F21), the last usage its NKRO input report declares.
 */

//& Public Variables

/** @brief One sendable usage with its display name, picker group and optional keycap text. */
export interface Usage {
	usage: number;
	name: string;
	group: string;
	short?: string;
}

/** @brief One modifier key: its bit in a modifier mask and its name. */
export interface Modifier {
	bit: number;
	name: string;
	short: string;
}

export const KEYBOARD_USAGES: readonly Usage[] = [
	...range(0x04, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), 'Letters'),
	...range(0x1e, '1234567890'.split(''), 'Digits'),
	...range(0x3a, numbered('F', 1, 12), 'Function keys'),
	...range(0x68, numbered('F', 13, 21), 'Function keys'),
	...range(0x28, ['Enter', 'Esc', 'Backspace', 'Tab', 'Space'], 'Editing'),
	...range(0x49, ['Insert', 'Home', 'Page Up', 'Delete', 'End', 'Page Down', 'Right', 'Left', 'Down', 'Up'], 'Navigation'),
	...range(0x2d, ['-', '=', '[', ']', '\\', '# (ISO)', ';', "'", '`', ',', '.', '/'], 'Symbols'),
	{ usage: 0x64, name: '\\ (ISO)', group: 'Symbols' },
	...range(0x39, ['Caps Lock'], 'System'),
	...range(0x46, ['Print Screen', 'Scroll Lock', 'Pause'], 'System'),
	{ usage: 0x53, name: 'Num Lock', group: 'System' },
	{ usage: 0x65, name: 'Menu', group: 'System' },
	...range(0x54, ['Num /', 'Num *', 'Num -', 'Num +', 'Num Enter'], 'Numpad'),
	...range(0x59, numbered('Num ', 1, 9), 'Numpad'),
	...range(0x62, ['Num 0', 'Num .'], 'Numpad'),
	{ usage: 0x67, name: 'Num =', group: 'Numpad' }
]; // keyboard page usages offered for remapping and macros

export const MODIFIERS: readonly Modifier[] = [
	{ bit: 0x01, name: 'Left Ctrl', short: 'Ctrl' },
	{ bit: 0x02, name: 'Left Shift', short: 'Shift' },
	{ bit: 0x04, name: 'Left Alt', short: 'Alt' },
	{ bit: 0x08, name: 'Left Win', short: 'Win' },
	{ bit: 0x10, name: 'Right Ctrl', short: 'RCtrl' },
	{ bit: 0x20, name: 'Right Shift', short: 'RShift' },
	{ bit: 0x40, name: 'Right Alt', short: 'RAlt' },
	{ bit: 0x80, name: 'Right Win', short: 'RWin' }
]; // modifier mask bits, in mask order

export const MODIFIER_USAGE_BASE = 0xe0; // keyboard usage of Left Ctrl; modifier bit n is usage 0xE0 + n

export const MEDIA_USAGES: readonly Usage[] = [
	{ usage: 0x0cd, name: 'Play / Pause', group: 'Playback', short: 'Play' },
	{ usage: 0x0b7, name: 'Stop', group: 'Playback', short: 'Stop' },
	{ usage: 0x0b6, name: 'Previous track', group: 'Playback', short: 'Prev' },
	{ usage: 0x0b5, name: 'Next track', group: 'Playback', short: 'Next' },
	{ usage: 0x0e9, name: 'Volume up', group: 'Volume', short: 'Vol+' },
	{ usage: 0x0ea, name: 'Volume down', group: 'Volume', short: 'Vol-' },
	{ usage: 0x0e2, name: 'Mute', group: 'Volume', short: 'Mute' },
	{ usage: 0x183, name: 'Media player', group: 'Apps', short: 'Media' },
	{ usage: 0x18a, name: 'Email', group: 'Apps', short: 'Mail' },
	{ usage: 0x192, name: 'Calculator', group: 'Apps', short: 'Calc' },
	{ usage: 0x194, name: 'My Computer', group: 'Apps', short: 'PC' },
	{ usage: 0x223, name: 'Browser home', group: 'Browser', short: 'Home' },
	{ usage: 0x224, name: 'Browser back', group: 'Browser', short: 'Back' },
	{ usage: 0x225, name: 'Browser forward', group: 'Browser', short: 'Fwd' },
	{ usage: 0x226, name: 'Browser stop', group: 'Browser', short: 'Stop' },
	{ usage: 0x227, name: 'Browser refresh', group: 'Browser', short: 'Rfsh' },
	{ usage: 0x221, name: 'Browser search', group: 'Browser', short: 'Find' },
	{ usage: 0x22a, name: 'Browser favourites', group: 'Browser', short: 'Fav' }
]; // consumer page usages the vendor app offers

export const SYSTEM_USAGES: readonly Usage[] = [
	{ usage: 0x81, name: 'Power off', group: 'System' },
	{ usage: 0x82, name: 'Sleep', group: 'System' },
	{ usage: 0x83, name: 'Wake', group: 'System' }
]; // generic desktop usages the keyboard's system control report declares

//& Private Variables

const KEYCAP_TEXT: Readonly<Record<string, string>> = {
	Backspace: 'Bksp',
	'Caps Lock': 'Caps',
	'Print Screen': 'PrtSc',
	'Scroll Lock': 'ScrLk',
	'Num Lock': 'NumLk',
	'Num Enter': 'NEnt',
	Insert: 'Ins',
	Delete: 'Del',
	'Page Up': 'PgUp',
	'Page Down': 'PgDn',
	Up: String.fromCharCode(0x2191), // up arrow
	Down: String.fromCharCode(0x2193), // down arrow
	Left: String.fromCharCode(0x2190), // left arrow
	Right: String.fromCharCode(0x2192), // right arrow
	'# (ISO)': '#',
	'\\ (ISO)': '\\'
}; // key names that do not fit a key

const KEY_CODES: Readonly<Record<string, number>> = {
	...codes(0x04, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`)),
	...codes(0x1e, numbered('Digit', 1, 9)),
	Digit0: 0x27,
	...codes(0x28, ['Enter', 'Escape', 'Backspace', 'Tab', 'Space', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash']),
	...codes(0x33, ['Semicolon', 'Quote', 'Backquote', 'Comma', 'Period', 'Slash', 'CapsLock']),
	...codes(0x3a, numbered('F', 1, 12)),
	...codes(0x46, ['PrintScreen', 'ScrollLock', 'Pause', 'Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown']),
	...codes(0x4f, ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'NumLock']),
	...codes(0x54, ['NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'NumpadAdd', 'NumpadEnter']),
	...codes(0x59, numbered('Numpad', 1, 9)),
	...codes(0x62, ['Numpad0', 'NumpadDecimal', 'IntlBackslash', 'ContextMenu']),
	NumpadEqual: 0x67,
	...codes(0x68, numbered('F', 13, 21)),
	...codes(0xe0, ['ControlLeft', 'ShiftLeft', 'AltLeft', 'MetaLeft', 'ControlRight', 'ShiftRight', 'AltRight', 'MetaRight'])
}; // KeyboardEvent.code -> keyboard page usage

const MEDIA_CODES: Readonly<Record<string, number>> = {
	MediaPlayPause: 0xcd,
	MediaStop: 0xb7,
	MediaTrackPrevious: 0xb6,
	MediaTrackNext: 0xb5,
	AudioVolumeUp: 0xe9,
	AudioVolumeDown: 0xea,
	AudioVolumeMute: 0xe2
}; // KeyboardEvent.code -> consumer page usage

//& Public Functions

/**
 * @brief Name a keyboard page usage, modifiers included.
 * @param[in] usage Keyboard page usage.
 * @return Display name, or the usage in hex when the table does not name it.
 */
export function keyName(usage: number): string {
	const modifier = MODIFIERS[usage - MODIFIER_USAGE_BASE]; // modifier keys sit at 0xE0..0xE7
	if (modifier) return modifier.name; // modifier name
	return KEYBOARD_USAGES.find((entry) => entry.usage === usage)?.name ?? `Key 0x${usage.toString(16).padStart(2, '0')}`; // table name or raw usage
}

/**
 * @brief Name a consumer page usage.
 * @param[in] usage Consumer page usage.
 * @return Display name, or the usage in hex when the table does not name it.
 */
export function mediaName(usage: number): string {
	return MEDIA_USAGES.find((entry) => entry.usage === usage)?.name ?? `Media 0x${usage.toString(16).padStart(3, '0')}`; // table name or raw usage
}

/**
 * @brief Name a generic desktop usage.
 * @param[in] usage Generic desktop page usage.
 * @return Display name, or the usage in hex when the table does not name it.
 */
export function systemName(usage: number): string {
	return SYSTEM_USAGES.find((entry) => entry.usage === usage)?.name ?? `System 0x${usage.toString(16).padStart(2, '0')}`; // table name or raw usage
}

/**
 * @brief Name the modifiers in a mask, joined with "+".
 * @param[in] mask OR of Modifier bits.
 * @param[in] short True for the short names used on keycaps.
 * @return Names in mask order, or an empty string for 0.
 */
export function modifierNames(mask: number, short = false): string {
	return MODIFIERS.filter((modifier) => mask & modifier.bit)
		.map((modifier) => (short ? modifier.short : modifier.name))
		.join('+'); // set bits, in mask order
}

/**
 * @brief Translate a browser key code into the usage the keyboard would send for it.
 * @param[in] code KeyboardEvent.code, e.g. "KeyA" or "ControlLeft".
 * @return Keyboard or consumer page usage, or null for a code the CK108 cannot send.
 */
export function usageForCode(code: string): { page: 'key' | 'media'; usage: number } | null {
	const key = KEY_CODES[code]; // keyboard page usage
	if (key !== undefined) return { page: 'key', usage: key }; // keyboard key
	const media = MEDIA_CODES[code]; // consumer page usage
	return media === undefined ? null : { page: 'media', usage: media }; // media key, or nothing
}

/**
 * @brief Keycap text for a keyboard usage, modifiers included.
 * @param[in] usage Keyboard page usage.
 * @return Short text that fits a key in the keyboard drawing.
 */
export function keyShort(usage: number): string {
	const modifier = MODIFIERS[usage - MODIFIER_USAGE_BASE]; // modifier keys sit at 0xE0..0xE7
	if (modifier) return modifier.short; // modifier keycap
	const name = keyName(usage); // full name
	return KEYCAP_TEXT[name] ?? name; // shortened where the name does not fit a key
}

/**
 * @brief Keycap text for a consumer usage.
 * @param[in] usage Consumer page usage.
 * @return Short text that fits a key in the keyboard drawing.
 */
export function mediaShort(usage: number): string {
	return MEDIA_USAGES.find((entry) => entry.usage === usage)?.short ?? 'Media'; // table keycap or generic text
}

//& Private Functions

/**
 * @brief Usages for consecutive names starting at one usage.
 * @param[in] first Usage of the first name.
 * @param[in] names Names in usage order.
 * @param[in] group Picker group for every entry.
 * @return One Usage per name.
 */
function range(first: number, names: readonly string[], group: string): Usage[] {
	return names.map((name, index) => ({ usage: first + index, name, group })); // consecutive usages
}

/**
 * @brief Map consecutive key codes to consecutive usages.
 * @param[in] first Usage of the first code.
 * @param[in] names KeyboardEvent.code values in usage order.
 * @return Code -> usage entries.
 */
function codes(first: number, names: readonly string[]): Record<string, number> {
	return Object.fromEntries(names.map((name, index) => [name, first + index])); // consecutive usages
}

/**
 * @brief Numbered names such as F1..F12.
 * @param[in] prefix Text before each number.
 * @param[in] from First number.
 * @param[in] to Last number, inclusive.
 * @return The names in order.
 */
function numbered(prefix: string, from: number, to: number): string[] {
	return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${from + index}`); // prefix plus number
}
