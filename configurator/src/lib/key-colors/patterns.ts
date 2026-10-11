/**
 * @file patterns.ts
 * @brief Per-key colour patterns for Custom backlit mode, ready-made or blended from the user's colours; each works out a colour for every drawn key from its
 *        place on the board and what it is for.
 * @note A pattern paints the drawn keys only; LED slots without a key keep their bytes.
 */

import { KEYS } from '#lib/ck108/layout.ts';
import { formatColor, parseColor } from '#lib/ck108/protocol.ts';

//& Public Variables

/** @brief What a key is for, as the theme and highlight patterns group keys. */
export type KeyKind = 'letter' | 'digit' | 'symbol' | 'function' | 'navigation' | 'numpad' | 'modifier';

/** @brief A drawn key's place on the board and what it is for: the input of every pattern. */
export interface KeyPlace {
	/** Vendor key name. */
	name: string;
	/** LED index; seeds the scattered patterns. */
	led: number;
	/** LED matrix row, 0 at the function row. */
	row: number;
	/** Keys to its left in its row. */
	rank: number;
	/** Key centre across the board: 0 at the leftmost key centre, 1 at the rightmost. */
	u: number;
	/** Key centre down the board: 0 at the top row, 1 at the bottom row. */
	v: number;
	/** Key centre along the board's 45-degree diagonal: 0 at the top left, 1 at the bottom right. */
	diagonal: number;
	/** Key centre's distance from the board centre on an ellipse that fits the board: 0 at the centre, 1 at the corners. */
	radius: number;
	/** What the key is for. */
	kind: KeyKind;
}

export const PATTERN_GROUPS = ['Gradients', 'Textures', 'Themes', 'Highlights', 'Solid'] as const; // gallery headings, in display order
export type PatternGroup = (typeof PATTERN_GROUPS)[number]; // one gallery heading

/** @brief Axis a custom gradient runs along: across the board, down it, along its diagonal, or out from its centre. */
export type GradientDirection = 'across' | 'down' | 'diagonal' | 'centre';

/** @brief A ready-made pattern: its gallery entry and the colour it gives a key, "#rrggbb" in lower case. */
export interface Pattern {
	id: string;
	name: string;
	group: PatternGroup;
	paint: (key: KeyPlace) => string;
}

//? The keys show a low channel level far brighter than a screen does, so a colour meant to stay blue keeps red at zero; a little red turns it pink.
export const PATTERNS: readonly Pattern[] = [
	{ id: 'rainbow', name: 'Rainbow', group: 'Gradients', paint: (key) => hue(key.u * 300) },
	{ id: 'rainbow-rows', name: 'Rainbow rows', group: 'Gradients', paint: (key) => ROW_RAINBOW[key.row] },
	{ id: 'diagonal-rainbow', name: 'Diagonal rainbow', group: 'Gradients', paint: (key) => hue(key.diagonal * 300) },
	{ id: 'sunset', name: 'Sunset', group: 'Gradients', paint: (key) => gradient(['#ffc400', '#ff6a00', '#ff2b8a', '#5b2bff'], key.u) },
	{ id: 'ocean', name: 'Ocean', group: 'Gradients', paint: (key) => gradient(['#00ffc8', '#00c8ff', '#0078ff', '#0028ff'], key.u) },
	{ id: 'aurora', name: 'Aurora', group: 'Gradients', paint: (key) => gradient(['#00ff80', '#00e5ff', '#7a3cff', '#ff3cc8'], key.diagonal) },
	{ id: 'synthwave', name: 'Synthwave', group: 'Gradients', paint: (key) => gradient(['#00e5ff', '#8a2bff', '#ff2bd6'], key.v) },
	{ id: 'fire', name: 'Fire', group: 'Gradients', paint: (key) => gradient(['#ff0a00', '#ff4a00', '#ff9000', '#ffd000'], key.v) },
	{ id: 'ice', name: 'Ice', group: 'Gradients', paint: (key) => gradient(['#ffffff', '#9ff0ff', '#38bfff', '#0050ff'], key.v) },
	{ id: 'forest', name: 'Forest', group: 'Gradients', paint: (key) => gradient(['#b4ff20', '#40e000', '#00b040', '#00806a'], key.diagonal) },
	{ id: 'candy', name: 'Candy', group: 'Gradients', paint: (key) => gradient(['#ff8ad8', '#c99bff', '#8ad8ff', '#9bffd0'], key.u) },
	{ id: 'sunburst', name: 'Sunburst', group: 'Gradients', paint: (key) => gradient(['#ffffff', '#ffe066', '#ff9a00', '#ff3c00', '#d00030'], key.radius) },
	{ id: 'galaxy', name: 'Galaxy', group: 'Textures', paint: galaxy },
	{ id: 'digital-rain', name: 'Digital rain', group: 'Textures', paint: digitalRain },
	{ id: 'lava', name: 'Lava', group: 'Textures', paint: lava },
	{ id: 'fireflies', name: 'Fireflies', group: 'Textures', paint: (key) => (noise(key.led, FIREFLY_SEED) < 0.15 ? '#d4ff3a' : '#002a5a') },
	{ id: 'confetti', name: 'Confetti', group: 'Textures', paint: (key) => hue(Math.floor(noise(key.led, CONFETTI_SEED) * 12) * 30) },
	{ id: 'police', name: 'Police', group: 'Themes', paint: (key) => (key.u < 0.5 ? '#ff0000' : '#0040ff') },
	{ id: 'halloween', name: 'Halloween', group: 'Themes', paint: (key) => (isAlphanumeric(key) ? '#ff6a00' : '#8a2bff') },
	{ id: 'festive', name: 'Festive', group: 'Themes', paint: (key) => ((key.row + key.rank) % 2 === 0 ? '#ff0000' : '#00e04a') },
	{ id: 'cyberpunk', name: 'Cyberpunk', group: 'Themes', paint: cyberpunk },
	{ id: 'royal', name: 'Royal', group: 'Themes', paint: (key) => (isAlphanumeric(key) ? '#ffb000' : '#5a1aff') },
	{ id: 'amber', name: 'Amber', group: 'Themes', paint: (key) => (key.kind === 'modifier' ? '#ff5a00' : '#ffb000') },
	{ id: 'gaming', name: 'Gaming', group: 'Highlights', paint: gaming },
	{ id: 'home-row', name: 'Home row', group: 'Highlights', paint: homeRow },
	{ id: 'key-groups', name: 'Key groups', group: 'Highlights', paint: (key) => KIND_COLORS[key.kind] },
	{ id: 'modifiers', name: 'Modifiers', group: 'Highlights', paint: (key) => (key.kind === 'modifier' ? '#ff7a00' : '#ffffff') },
	{ id: 'white', name: 'White', group: 'Solid', paint: () => '#ffffff' },
	{ id: 'warm-white', name: 'Warm white', group: 'Solid', paint: () => '#ffb46b' },
	{ id: 'off', name: 'All off', group: 'Solid', paint: () => '#000000' }
]; // gallery, in display order

//& Private Variables

const LED_COLUMNS = 21; // LEDs per matrix row: LED index = row * LED_COLUMNS + column
const BOARD_ROWS = 6; // LED matrix rows
const RAIN_COLUMNS = 22; // drop columns across the board, about one key wide each
const RAIN_TRAIL = 3; // rows of fading trail above each drop's head
const [GALAXY_SEED, STAR_SEED, RAIN_SEED, LAVA_SEED, FIREFLY_SEED, CONFETTI_SEED] = [1, 2, 3, 4, 5, 6]; // noise() seeds, one per use, so patterns do not share scatter
const ROW_RAINBOW = ['#ff0000', '#ff7a00', '#ffd400', '#00e04a', '#0050ff', '#8a2bff']; // one colour per matrix row, top to bottom
const STARS = ['#ffffff', '#ffb0f0', '#a0e0ff']; // Galaxy star colours
const KIND_COLORS: Readonly<Record<KeyKind, string>> = {
	letter: '#ffffff',
	digit: '#ffd400',
	function: '#ff0000',
	navigation: '#00e04a',
	numpad: '#00d5ff',
	symbol: '#0050ff',
	modifier: '#0050ff'
}; // Key groups colour by kind
const NAVIGATION = new Set(['PrintScreen', 'ScrollLock', 'Pause/Break', 'Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown', 'Up', 'Down', 'Left', 'Right']); // cluster and arrows
const SYMBOLS = new Set(['`', '-', '+', '[', ']', '\\', ';', "'", ',', '.', '/']); // punctuation keys of the main block
const MOVEMENT = new Set(['W', 'A', 'S', 'D', 'Up', 'Down', 'Left', 'Right']); // keys that move a game character
const GAME_KEYS = new Set(['Esc', '1', '2', '3', '4', '5', 'Tab', 'Q', 'E', 'R', 'F', 'G', 'Shift', 'Ctrl', 'Space']); // keys in reach of WASD
const HOME_ROW = new Set(['A', 'S', 'D', 'F', 'J', 'K', 'L', ';']); // keys the fingers rest on
const BUMPS = new Set(['F', 'J']); // home keys with a locating bump
const GRADIENT_AXES: Readonly<Record<GradientDirection, 'u' | 'v' | 'diagonal' | 'radius'>> = { across: 'u', down: 'v', diagonal: 'diagonal', centre: 'radius' }; // KeyPlace field per direction
let places: KeyPlace[] | undefined; // every drawn key's place, worked out on first use

//& Public Functions

/**
 * @brief Work out a pattern's colour for every drawn key.
 * @param[in] pattern An entry of PATTERNS.
 * @return One "#rrggbb" per entry of KEYS, in KEYS order.
 */
export function patternColors(pattern: Pattern): string[] {
	return keyPlaces().map((place) => pattern.paint(place)); // colour per key
}

/**
 * @brief Blend colours over every drawn key.
 * @param[in] stops "#rrggbb" colours, evenly spaced from the start of direction to its end.
 * @param[in] direction Axis the blend runs along.
 * @return One "#rrggbb" per entry of KEYS, in KEYS order.
 * @throws RangeError stops holds fewer than two colours, or a stop is not "#rrggbb".
 */
export function gradientColors(stops: readonly string[], direction: GradientDirection): string[] {
	//- Input validation
	if (stops.length < 2) throw new RangeError(`a gradient needs two or more colours, not ${stops.length}`); // reject

	//- Blend along the chosen axis
	const axis = GRADIENT_AXES[direction]; // KeyPlace field the blend follows
	return keyPlaces().map((place) => gradient(stops, place[axis])); // colour per key
}

/**
 * @brief Paint key colours into a copy of a per-key colour buffer.
 * @param[in] keyColors One "#rrggbb" per entry of KEYS, as patternColors() returns them.
 * @param[in] base Per-key colour buffer to start from.
 * @return The new buffer; LED slots without a key keep base's bytes.
 */
export function paintKeys(keyColors: readonly string[], base: Uint8Array): Uint8Array<ArrayBuffer> {
	const next = base.slice(); // edit a copy; base stays as shown
	KEYS.forEach((key, index) => next.set(parseColor(keyColors[index]), key.led * 3)); // each key's R G B
	return next; // painted buffer
}

/**
 * @brief Tell whether a per-key colour buffer gives every drawn key the given colour.
 * @param[in] buffer Per-key colour buffer.
 * @param[in] keyColors One "#rrggbb" per entry of KEYS, as patternColors() returns them.
 * @return True when every drawn key matches.
 */
export function showsColors(buffer: Uint8Array, keyColors: readonly string[]): boolean {
	return KEYS.every((key, index) => formatColor(buffer, key.led * 3) === keyColors[index]); // key by key
}

//& Private Functions

/**
 * @brief Every drawn key's place, worked out once from the layout.
 * @return One KeyPlace per entry of KEYS, in KEYS order.
 */
function keyPlaces(): KeyPlace[] {
	//- Reuse the first result
	if (places) return places; // worked out before

	//- Board extent, from the key centres
	const centres = KEYS.map((key) => ({ x: key.x + key.w / 2, y: key.y + key.h / 2 })); // key centres in drawing units
	const left = Math.min(...centres.map((centre) => centre.x)); // leftmost centre
	const top = Math.min(...centres.map((centre) => centre.y)); // top row centre
	const width = Math.max(...centres.map((centre) => centre.x)) - left; // centre span across
	const height = Math.max(...centres.map((centre) => centre.y)) - top; // centre span down
	const rowOf = (led: number) => Math.floor(led / LED_COLUMNS); // matrix row of an LED

	//- One place per key
	places = KEYS.map((key, index) => {
		const { x, y } = centres[index]; // this key's centre
		const [u, v] = [(x - left) / width, (y - top) / height]; // centre as board fractions
		return {
			name: key.name, // vendor key name
			led: key.led, // LED index
			row: rowOf(key.led), // matrix row
			rank: KEYS.filter((other) => rowOf(other.led) === rowOf(key.led) && other.x < key.x).length, // keys to its left in the row
			u, // across the board
			v, // down the board
			diagonal: (x - left + (y - top)) / (width + height), // along the 45-degree diagonal
			radius: Math.hypot(u - 0.5, v - 0.5) / Math.SQRT1_2, // distance from the centre, 1 at a corner
			kind: kindOf(key.name) // what the key is for
		};
	}); // places in KEYS order
	return places; // computed places
}

/**
 * @brief Tell what a key is for from its vendor name.
 * @param[in] name Vendor key name.
 * @return The key's kind; keys no other kind claims are modifiers.
 */
function kindOf(name: string): KeyKind {
	if (/^[A-Z]$/.test(name)) return 'letter'; // A to Z
	if (/^[0-9]$/.test(name)) return 'digit'; // number row
	if (name === 'Esc' || /^F[0-9]+$/.test(name)) return 'function'; // Esc and the F-keys
	if (name.startsWith('Num')) return 'numpad'; // keypad and Num Lock
	if (NAVIGATION.has(name)) return 'navigation'; // cluster and arrows
	if (SYMBOLS.has(name)) return 'symbol'; // punctuation
	return 'modifier'; // Shift, Ctrl, Space, Enter and the other wide keys
}

/**
 * @brief Tell whether a key types a letter or a digit.
 * @param[in] key Key place.
 * @return True for letters and the number row.
 */
function isAlphanumeric(key: KeyPlace): boolean {
	return key.kind === 'letter' || key.kind === 'digit'; // letter or digit
}

/**
 * @brief Galaxy: scattered white, pink and blue stars on an indigo to purple sky.
 * @param[in] key Key place.
 * @return "#rrggbb".
 */
function galaxy(key: KeyPlace): string {
	if (noise(key.led, GALAXY_SEED) < 0.16) return STARS[Math.floor(noise(key.led, STAR_SEED) * STARS.length)]; // star
	return gradient(['#2a10c0', '#7010b0'], key.diagonal); // sky
}

/**
 * @brief Digital rain: green trails falling down the board, each with a pale head and a fading tail above it.
 * @param[in] key Key place.
 * @return "#rrggbb".
 */
function digitalRain(key: KeyPlace): string {
	const column = Math.floor(key.u * RAIN_COLUMNS); // drop column the key sits in
	const head = Math.floor(noise(column, RAIN_SEED) * (BOARD_ROWS + 2)) - 1; // row of the drop's head, off the board for some columns
	const above = head - key.row; // rows from the key down to the head
	if (above === 0) return '#c8ffc8'; // head
	if (above > 0 && above <= RAIN_TRAIL) return dim('#00ff40', 1 - above / (RAIN_TRAIL + 1)); // tail, fading away from the head
	return dim('#00ff40', 0.12); // dark screen
}

/**
 * @brief Lava: a red crust with scattered glowing, hot and white-hot keys.
 * @param[in] key Key place.
 * @return "#rrggbb".
 */
function lava(key: KeyPlace): string {
	const heat = noise(key.led, LAVA_SEED); // fixed heat per key
	if (heat > 0.93) return '#ffd800'; // white-hot
	if (heat > 0.75) return '#ff8a00'; // hot
	if (heat > 0.45) return '#ff3c00'; // glowing
	return '#d00a00'; // crust
}

/**
 * @brief Cyberpunk: yellow letters and digits, magenta modifiers, cyan everything else.
 * @param[in] key Key place.
 * @return "#rrggbb".
 */
function cyberpunk(key: KeyPlace): string {
	if (isAlphanumeric(key)) return '#ffe600'; // letters and digits
	if (key.kind === 'modifier') return '#ff00a0'; // modifiers
	return '#00f0ff'; // F-keys, symbols, navigation and keypad
}

/**
 * @brief Gaming: red WASD and arrows, orange keys around WASD, dim blue elsewhere.
 * @param[in] key Key place.
 * @return "#rrggbb".
 */
function gaming(key: KeyPlace): string {
	if (MOVEMENT.has(key.name)) return '#ff0000'; // movement keys
	if (GAME_KEYS.has(key.name)) return '#ff7a00'; // keys in reach of WASD
	return '#002a90'; // everything else
}

/**
 * @brief Home row: magenta F and J, cyan for the other home keys, dim white elsewhere.
 * @param[in] key Key place.
 * @return "#rrggbb".
 */
function homeRow(key: KeyPlace): string {
	if (BUMPS.has(key.name)) return '#ff2bd6'; // keys with a bump
	if (HOME_ROW.has(key.name)) return '#00d5ff'; // other home keys
	return '#666666'; // everything else
}

/**
 * @brief Colour of a hue at full saturation and brightness.
 * @param[in] degrees Hue angle: 0 red, 120 green, 240 blue; wraps past 360.
 * @return "#rrggbb".
 */
function hue(degrees: number): string {
	const level = (n: number) => {
		const k = (n + degrees / 60) % 6; // channel's place on the hue wheel
		return 1 - Math.max(0, Math.min(k, 4 - k, 1)); // channel level, 0..1
	}; // HSV channel at full saturation and value
	return formatColor(Uint8Array.from([level(5), level(3), level(1)], (channel) => Math.round(channel * 255))); // R G B
}

/**
 * @brief Colour at a point along evenly spaced colour stops.
 * @param[in] stops "#rrggbb" stops, the first at 0 and the last at 1.
 * @param[in] at Position, clamped to 0..1.
 * @return "#rrggbb" blended from the two stops around the position.
 */
function gradient(stops: readonly string[], at: number): string {
	const position = Math.min(Math.max(at, 0), 1) * (stops.length - 1); // place along the stops
	const index = Math.min(Math.floor(position), stops.length - 2); // stop at or before it
	const [from, to] = [parseColor(stops[index]), parseColor(stops[index + 1])]; // stops around it
	return formatColor(from.map((level, channel) => Math.round(level + (to[channel] - level) * (position - index)))); // channel-wise blend
}

/**
 * @brief Darken a colour.
 * @param[in] color "#rrggbb".
 * @param[in] factor 0..1; 1 keeps the colour.
 * @return "#rrggbb" with every channel scaled by factor.
 */
function dim(color: string, factor: number): string {
	return formatColor(parseColor(color).map((level) => Math.round(level * factor))); // each channel scaled
}

/**
 * @brief Fixed pseudo-random number, so a scattered pattern looks the same every time it is drawn or painted.
 * @param[in] n Key LED or drop column.
 * @param[in] seed One of the *_SEED values, so patterns do not share their scatter.
 * @return A value from 0 up to, not including, 1.
 */
function noise(n: number, seed: number): number {
	let hash = Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(seed + 1, 0x85ebca6b); // combine number and seed
	hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d); // first mixing round
	hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b); // second mixing round
	return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000; // fraction of 2^32
}
