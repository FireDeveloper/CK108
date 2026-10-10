/**
 * @file protocol.ts
 * @brief CK108 wire format: request framing, checksum, reply parsing, info and lighting decoders, lighting field encoders,
 *        per-effect controls and colour conversion.
 * @note WebHID carries the report ID outside the report data, so every data index here is one less than the byte number in PROTOCOL.md.
 */

//& Public Variables

export const VENDOR_ID = 0x0c45; // SONiX
export const PRODUCT_ID = 0x8502; // CK108
export const USAGE_PAGE = 0xff1c; // vendor configuration collection
export const USAGE = 0x92; // configuration collection usage
export const REPORT_ID = 0x04; // report ID of every request and reply

export const DATA_SIZE = 63; // report data length, report ID excluded
export const PAYLOAD_INDEX = 7; // data index of the first payload byte
export const CHUNK_SIZE = 0x38; // largest payload per packet
export const STATUS_REJECTED = [0xff, 0xfe]; // reply status values that mean failure

export const Command = {
	begin: 0x01, // open a configuration session
	end: 0x02, // close the session and apply
	readInfo: 0x03, // read the info block
	writeInfo: 0x04, // write the info block
	readLighting: 0x05, // read the lighting block
	writeLighting: 0x06, // write the lighting block at an offset
	readKeymap: 0x07, // read a profile key map
	writeKeymap: 0x08, // write a profile key map
	readMacros: 0x09, // read the macro blob
	writeMacros: 0x0a, // write the macro blob
	readDefaultKeymap: 0x0f, // read the factory key map
	readKeyColors: 0x10, // read per-key colours
	writeKeyColors: 0x11 // write per-key colours
} as const;

export const LED_SLOTS = 144; // per-key colour buffer length in LEDs
export const LEDS_PER_CHUNK = 18; // LEDs per colour packet, 54 bytes
export const KEY_COLORS_SIZE = LED_SLOTS * 3; // per-key colour buffer length in bytes, R G B per LED

export const SESSION_END_DELAY_MS = 10; // pause before Command.end, as in the vendor app

export const INFO_SIZE = 0x2c; // info block length
export const INFO_PROFILE = 0x0a; // info block offset of the active profile
export const LIGHTING_SIZE = 0x38; // lighting block length
export const LIGHTING_SETTINGS_SIZE = 0x23; // leading lighting bytes the vendor Default button writes: mode through the extra colour slots
export const LEVEL_MAX = 5; // highest brightness and speed level

export const LightingOffset = {
	mode: 0x00, // effect mode
	brightness: 0x01, // brightness level
	speed: 0x02, // speed level, LEVEL_MAX is slowest
	direction: 0x03, // 0 forward, 1 reverse
	colorful: 0x04, // rainbow flag
	color: 0x05 // effect colour, R G B
} as const;

export const MODE_CUSTOM = 20; // per-key colour mode

/** @brief Lighting controls an effect uses, as the vendor app shows them. */
export interface ModeControls {
	speed: boolean;
	direction: boolean;
	color: boolean;
	rainbow: boolean;
}

export const MODES: Readonly<Record<number, string>> = {
	1: 'Go with the stream',
	2: 'Clouds fly',
	3: 'Winding paths',
	4: 'The trial of light',
	5: 'Breathing',
	6: 'Normally on',
	7: 'Pass without trace',
	8: 'Ripple graff',
	9: 'Fast run without trace',
	10: 'Swift action',
	11: 'Flowers blooming',
	12: 'Snow winter jasmine',
	13: 'Hurricane',
	14: 'Accumulate',
	15: 'Digital Times',
	16: 'Both ways',
	17: 'Surmount',
	18: 'Fast and the Furious',
	20: 'Custom backlit mode'
}; // mode byte -> vendor UI name

/** @brief Decoded info block. */
export interface Info {
	vendorId: number;
	productId: number;
	firmware: number;
	profile: number;
	macroSpace: number;
	modes: number[];
}

/** @brief Decoded lighting block fields the configurator shows. */
export interface Lighting {
	mode: number;
	brightness: number;
	speed: number;
	direction: number;
	colorful: boolean;
	color: string;
}

/** @brief Command echo, status and payload of one reply. */
export interface Reply {
	command: number;
	status: number;
	payload: Uint8Array;
}

/** @brief One lighting block write: offset and bytes. */
export type LightingField = readonly [offset: number, data: Uint8Array<ArrayBuffer>];

//& Private Variables

//? Which effects show which control, taken from the vendor app's per-mode control visibility; effect 17's preset colours are not mapped yet.
const SPEED = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15]); // effects with a speed slider
const DIRECTION = new Set([1, 2, 3, 12, 18]); // effects with a direction choice
const COLOR = new Set([1, 2, 3, 5, 6, 7, 8, 9, 13, 14, 15, 16]); // effects with a colour picker
const RAINBOW = new Set([1, 2, 3, 5, 7, 8, 9, 13, 14, 15, 16]); // effects with a rainbow switch

//& Public Functions

/**
 * @brief Frame one request as WebHID report data: checksum, command, length, offset, status, payload.
 * @param[in] command Command byte, a Command value.
 * @param[in] length Length field, 0..CHUNK_SIZE.
 * @param[in] offset Offset field, 0..0xFFFF.
 * @param[in] payload Bytes placed at PAYLOAD_INDEX; at most CHUNK_SIZE.
 * @return DATA_SIZE bytes for HIDDevice.sendReport(REPORT_ID, ...).
 * @throws RangeError A field is out of range.
 */
export function buildRequest(command: number, length = 0, offset = 0, payload = new Uint8Array()): Uint8Array<ArrayBuffer> {
	//- Input validation
	if (length < 0 || length > CHUNK_SIZE || offset < 0 || offset > 0xffff || payload.length > CHUNK_SIZE) { // fields fit the header
		throw new RangeError(`bad request fields: length=${length} offset=${offset} payload=${payload.length}`); // reject the request
	}

	//- Header and payload
	const data = new Uint8Array(DATA_SIZE); // zero-filled report data
	data[2] = command; // command
	data[3] = length; // payload length
	data[4] = offset & 0xff; // offset, low byte
	data[5] = offset >> 8; // offset, high byte
	data.set(payload, PAYLOAD_INDEX); // payload

	//- Checksum over the command byte onward
	const sum = data.subarray(2).reduce((acc, byte) => acc + byte, 0) & 0xffff; // u16 sum
	data[0] = sum & 0xff; // checksum, low byte
	data[1] = sum >> 8; // checksum, high byte
	return data; // framed request
}

/**
 * @brief Split one reply into command echo, status and payload.
 * @param[in] data Report data from an inputreport event.
 * @return The parsed reply.
 */
export function parseReply(data: DataView): Reply {
	const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength); // byte view of the report
	return { command: bytes[2], status: bytes[6], payload: bytes.slice(PAYLOAD_INDEX) }; // header fields and payload copy
}

/**
 * @brief Decode the info block.
 * @param[in] block INFO_SIZE bytes from Command.readInfo.
 * @return Identity, firmware, active profile, macro space and supported modes.
 */
export function decodeInfo(block: Uint8Array): Info {
	const modes = block.subarray(16); // zero-terminated mode list
	const end = modes.indexOf(0); // terminator position
	return {
		vendorId: block[4] | (block[5] << 8), // VID, u16 LE
		productId: block[6] | (block[7] << 8), // PID, u16 LE
		firmware: block[8] | (block[9] << 8), // firmware version, u16 LE
		profile: block[INFO_PROFILE], // active profile
		macroSpace: block[11] << 7, // macro blob limit in bytes, stored in 128-byte units
		modes: Array.from(end < 0 ? modes : modes.subarray(0, end)) // supported mode bytes in UI order
	};
}

/**
 * @brief Decode the lighting block fields the configurator shows.
 * @param[in] block LIGHTING_SIZE bytes from Command.readLighting.
 * @return Mode, levels, direction, rainbow flag and effect colour.
 */
export function decodeLighting(block: Uint8Array): Lighting {
	return {
		mode: block[0], // effect mode
		brightness: block[1], // brightness level
		speed: block[2], // speed level
		direction: block[3], // direction, 0xFF when the mode has none
		colorful: block[4] !== 0, // rainbow flag
		color: formatColor(block, LightingOffset.color) // effect colour as CSS hex
	};
}

/**
 * @brief Lighting controls an effect uses.
 * @param[in] mode Mode byte.
 * @return Which of speed, direction, colour and rainbow apply; brightness always applies.
 */
export function modeControls(mode: number): ModeControls {
	return { speed: SPEED.has(mode), direction: DIRECTION.has(mode), color: COLOR.has(mode), rainbow: RAINBOW.has(mode) }; // flags per control
}

/**
 * @brief Lighting write for a single-byte field.
 * @param[in] offset A LightingOffset value.
 * @param[in] value 0..255.
 * @return The field write.
 */
export function byteField(offset: number, value: number): LightingField {
	return [offset, Uint8Array.of(value)]; // one byte at offset
}

/**
 * @brief Lighting writes for a solid effect colour, as the vendor colour picker sends them: rainbow off, then R G B.
 * @param[in] color CSS hex colour, "#rrggbb".
 * @return The field writes, in send order.
 * @throws RangeError color is not "#rrggbb".
 */
export function colorFields(color: string): LightingField[] {
	return [byteField(LightingOffset.colorful, 0), [LightingOffset.color, parseColor(color)]]; // rainbow off, then R G B, vendor order
}

/**
 * @brief Convert a CSS hex colour to R G B bytes.
 * @param[in] color "#rrggbb".
 * @return Three bytes, R G B.
 * @throws RangeError color is not "#rrggbb".
 */
export function parseColor(color: string): Uint8Array<ArrayBuffer> {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color); // R, G, B hex pairs
	if (!match) throw new RangeError(`not a #rrggbb colour: ${color}`); // reject
	return Uint8Array.from(match.slice(1), (pair) => parseInt(pair, 16)); // R G B bytes
}

/**
 * @brief Format R G B bytes as a CSS hex colour.
 * @param[in] rgb Buffer holding R G B at offset.
 * @param[in] offset Index of R.
 * @return "#rrggbb".
 */
export function formatColor(rgb: Uint8Array, offset = 0): string {
	const hex = (byte: number) => byte.toString(16).padStart(2, '0'); // two-digit hex byte
	return `#${hex(rgb[offset])}${hex(rgb[offset + 1])}${hex(rgb[offset + 2])}`; // CSS colour
}

/**
 * @brief Format a 16-bit value as four uppercase hex digits.
 * @param[in] value 0..0xFFFF.
 * @return Hex string without prefix.
 */
export function hex16(value: number): string {
	return value.toString(16).toUpperCase().padStart(4, '0'); // zero-padded hex
}
