/**
 * @file macros.ts
 * @brief CK108 macro blob: the macro model, its encoder and decoder, and fitting the blob into the keyboard's macro space.
 * @note Every multi-byte field is little-endian and records are packed; PROTOCOL.md describes the layout.
 */

import { MODIFIER_USAGE_BASE, keyName, mediaName, systemName } from './usages.ts';

//& Public Variables

export const MACRO_MAGIC = 0x55aa; // first u16 of a stored blob
export const HEADER_SIZE = 16; // magic, size, count, names flag, reserved
export const MACRO_LIMIT = 100; // most macros the vendor app stores
export const STEP_LIMIT = 2000; // most steps per macro the vendor app stores
export const CYCLES_MAX = 255; // most plays per key press, a u8
export const NAME_LIMIT = 255; // longest name in UTF-16 units, a u8 length
export const DELAY_STEP_MS = 10; // delay resolution
export const DELAY_MAX_MS = 40000; // longest delay the vendor app accepts; the 12-bit field holds 40950

/** @brief What one macro step presses or releases. */
export type StepTarget =
	| { page: 'key'; usage: number } // keyboard page usage, modifiers as 0xE0..0xE7
	| { page: 'media'; usage: number } // consumer page usage
	| { page: 'system'; usage: number } // generic desktop usage: power, sleep, wake
	| { page: 'raw'; kind: number; data: readonly [number, number] }; // a step the configurator does not decode, kept as stored

/** @brief One macro step: a press or release, then a pause. */
export interface MacroStep {
	press: boolean;
	target: StepTarget;
	delay: number;
}

/** @brief One stored macro. */
export interface Macro {
	name: string;
	cycles: number;
	steps: MacroStep[];
}

/** @brief A blob ready to write, and whether the names fitted. */
export interface PackedMacros {
	blob: Uint8Array<ArrayBuffer>;
	hasNames: boolean;
}

//& Private Variables

const KIND_KEYBOARD = 2; // step kind: keyboard page
const KIND_CONSUMER = 3; // step kind: consumer page
const KIND_SYSTEM = 4; // step kind: generic desktop page
const KEYBOARD_MODIFIER = 0x01; // keyboard data byte 0: byte 1 is a modifier mask
const KEYBOARD_KEY = 0x02; // keyboard data byte 0: byte 1 is a usage
const PRESS_BIT = 0x8000; // step word: set for a press, clear for a release
const KIND_SHIFT = 12; // step word: kind in bits 12..14
const DELAY_MASK = 0x0fff; // step word: delay in DELAY_STEP_MS units, bits 0..11
const RECORD_HEADER_SIZE = 4; // step count u16, cycles u8, name length u8
const STEP_SIZE = 4; // step word u16, data 2 bytes

//& Public Functions

/**
 * @brief Decode a blob read from the keyboard.
 * @param[in] blob Bytes from Command.readMacros, starting at offset 0.
 * @return The macros in stored order; empty when the blob carries no magic.
 * @throws RangeError The blob is shorter than its header or a record says.
 */
export function decodeMacros(blob: Uint8Array): Macro[] {
	//- Header
	const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength); // little-endian reader
	if (blob.length < HEADER_SIZE || view.getUint16(0, true) !== MACRO_MAGIC) return []; // never written: no macros
	const size = view.getUint16(2, true); // declared blob length
	const count = view.getUint16(4, true); // macros stored
	if (size > blob.length || HEADER_SIZE + count * 2 > size) throw new RangeError(`macro blob is damaged: ${size} bytes declared, ${blob.length} read`); // truncated

	//- Records
	const macros: Macro[] = []; // decoded macros
	for (let index = 0; index < count; index++) { // one record per offset
		const at = view.getUint16(HEADER_SIZE + index * 2, true); // record offset from blob start
		if (at + RECORD_HEADER_SIZE > size) throw new RangeError(`macro ${index + 1} starts past the blob end`); // bad offset
		const stepCount = view.getUint16(at, true); // steps in this macro
		const nameLength = blob[at + 3]; // name length in UTF-16 units, 0 without names
		const nameAt = at + RECORD_HEADER_SIZE + stepCount * STEP_SIZE; // first name byte
		if (nameAt + nameLength * 2 > size) throw new RangeError(`macro ${index + 1} runs past the blob end`); // bad record
		const steps = Array.from({ length: stepCount }, (_, step) => decodeStep(view, at + RECORD_HEADER_SIZE + step * STEP_SIZE)); // step list
		const name = String.fromCharCode(...Array.from({ length: nameLength }, (_, unit) => view.getUint16(nameAt + unit * 2, true))); // UTF-16LE name
		macros.push({ name: name || `Macro ${index + 1}`, cycles: blob[at + 2], steps }); // vendor app's default name when names were dropped
	}
	return macros; // stored order
}

/**
 * @brief Encode macros as a blob, the way the vendor app lays it out.
 * @param[in] macros Macros in the order key map entries refer to them.
 * @param[in] withNames True to store names; false stores none, as the vendor app does when they do not fit.
 * @return The blob, exactly blobSize() bytes.
 */
export function encodeMacros(macros: readonly Macro[], withNames: boolean): Uint8Array<ArrayBuffer> {
	//- Header and offset table
	const size = blobSize(macros, withNames); // whole blob
	const blob = new Uint8Array(size); // zeroed, reserved bytes included
	const view = new DataView(blob.buffer); // little-endian writer
	view.setUint16(0, MACRO_MAGIC, true); // magic
	view.setUint16(2, size, true); // blob length
	view.setUint16(4, macros.length, true); // macro count
	view.setUint16(6, withNames ? 1 : 0, true); // names flag

	//- Records, packed in order
	let at = HEADER_SIZE + macros.length * 2; // first record follows the offset table
	macros.forEach((macro, index) => {
		const name = withNames ? macro.name.slice(0, NAME_LIMIT) : ''; // stored name
		view.setUint16(HEADER_SIZE + index * 2, at, true); // record offset
		view.setUint16(at, macro.steps.length, true); // step count
		blob[at + 2] = clamp(Math.round(macro.cycles), 1, CYCLES_MAX); // plays per key press
		blob[at + 3] = name.length; // name length in UTF-16 units
		at += RECORD_HEADER_SIZE; // first step
		for (const step of macro.steps) { // one 4-byte step each
			encodeStep(view, at, step); // word and data
			at += STEP_SIZE; // next step
		}
		for (let unit = 0; unit < name.length; unit++) view.setUint16(at + unit * 2, name.charCodeAt(unit), true); // UTF-16LE name
		at += name.length * 2; // next record
	});
	return blob; // ready to write
}

/**
 * @brief Length of the blob encodeMacros() would build.
 * @param[in] macros Macros to store.
 * @param[in] withNames True to count names.
 * @return Bytes, header included.
 */
export function blobSize(macros: readonly Macro[], withNames: boolean): number {
	return macros.reduce(
		(total, macro) => total + RECORD_HEADER_SIZE + macro.steps.length * STEP_SIZE + (withNames ? Math.min(macro.name.length, NAME_LIMIT) * 2 : 0),
		HEADER_SIZE + macros.length * 2
	); // header, offset table, records
}

/**
 * @brief Build the blob to write, dropping the names when only that makes it fit, as the vendor app does.
 * @param[in] macros Macros to store.
 * @param[in] space Macro space of the keyboard in bytes, Info.macroSpace.
 * @return The blob and whether it carries names.
 * @throws RangeError The macros do not fit even without names, or break a vendor app limit.
 */
export function packMacros(macros: readonly Macro[], space: number): PackedMacros {
	//- Vendor app limits
	if (macros.length > MACRO_LIMIT) throw new RangeError(`at most ${MACRO_LIMIT} macros fit; there are ${macros.length}`); // too many macros
	const long = macros.find((macro) => macro.steps.length > STEP_LIMIT); // macro over the step limit
	if (long) throw new RangeError(`"${long.name}" has ${long.steps.length} steps; at most ${STEP_LIMIT} fit`); // too many steps

	//- Fit, with names if possible
	if (blobSize(macros, true) <= space) return { blob: encodeMacros(macros, true), hasNames: true }; // everything fits
	if (blobSize(macros, false) <= space) return { blob: encodeMacros(macros, false), hasNames: false }; // fits without names
	throw new RangeError(`the macros need ${blobSize(macros, false)} bytes; the keyboard holds ${space}`); // too big
}

/**
 * @brief Clamp and round a delay to what a step can store.
 * @param[in] ms Requested pause in milliseconds.
 * @return 0..DELAY_MAX_MS, a multiple of DELAY_STEP_MS.
 */
export function storableDelay(ms: number): number {
	return Math.floor(clamp(ms, 0, DELAY_MAX_MS) / DELAY_STEP_MS) * DELAY_STEP_MS; // round down, as the vendor app does
}

/**
 * @brief Name what a step acts on.
 * @param[in] target Step target.
 * @return Key, media or system name, or the stored bytes for an undecoded step.
 */
export function targetName(target: StepTarget): string {
	switch (target.page) {
		case 'key':
			return keyName(target.usage); // keyboard key or modifier
		case 'media':
			return mediaName(target.usage); // media key
		case 'system':
			return systemName(target.usage); // power key
		case 'raw':
			return `Unknown step ${target.kind}:${target.data.map((byte) => byte.toString(16).padStart(2, '0')).join(' ')}`; // stored bytes
	}
}

//& Private Functions

/**
 * @brief Decode one step.
 * @param[in] view Blob reader.
 * @param[in] at Offset of the step word.
 * @return The step.
 */
function decodeStep(view: DataView, at: number): MacroStep {
	//- Word: press bit, kind, delay
	const word = view.getUint16(at, true); // step word
	const kind = (word >> KIND_SHIFT) & 0x7; // usage page code
	const press = (word & PRESS_BIT) !== 0; // press or release
	const delay = (word & DELAY_MASK) * DELAY_STEP_MS; // pause after the step
	const [first, second] = [view.getUint8(at + 2), view.getUint8(at + 3)]; // data bytes

	//- Data by kind
	const mask = second; // modifier mask, when the step is a modifier
	const isOneModifier = kind === KIND_KEYBOARD && first === KEYBOARD_MODIFIER && mask !== 0 && (mask & (mask - 1)) === 0; // exactly one bit
	let target: StepTarget = { page: 'raw', kind, data: [first, second] }; // kept as stored unless decoded below
	if (isOneModifier) target = { page: 'key', usage: MODIFIER_USAGE_BASE + Math.log2(mask) }; // modifier as its usage
	else if (kind === KIND_KEYBOARD && first === KEYBOARD_KEY) target = { page: 'key', usage: second }; // plain key
	else if (kind === KIND_CONSUMER) target = { page: 'media', usage: first | (second << 8) }; // consumer usage, u16 LE
	else if (kind === KIND_SYSTEM) target = { page: 'system', usage: first | (second << 8) }; // generic desktop usage, u16 LE
	return { press, target, delay }; // decoded step
}

/**
 * @brief Encode one step.
 * @param[in] view Blob writer.
 * @param[in] at Offset of the step word.
 * @param[in] step Step to store.
 */
function encodeStep(view: DataView, at: number, step: MacroStep): void {
	//- Data bytes and kind
	const { target } = step; // what the step acts on
	const modifier = target.page === 'key' ? target.usage - MODIFIER_USAGE_BASE : -1; // modifier number 0..7, or out of range
	let kind = KIND_KEYBOARD; // usage page code
	let data = 0; // data bytes as a u16 LE
	if (target.page === 'key' && modifier >= 0 && modifier < 8) data = KEYBOARD_MODIFIER | ((1 << modifier) << 8); // one-bit modifier mask
	else if (target.page === 'key') data = KEYBOARD_KEY | (target.usage << 8); // plain key
	else if (target.page === 'media') [kind, data] = [KIND_CONSUMER, target.usage]; // consumer usage
	else if (target.page === 'system') [kind, data] = [KIND_SYSTEM, target.usage]; // generic desktop usage
	else [kind, data] = [target.kind, target.data[0] | (target.data[1] << 8)]; // undecoded step, as read

	//- Word: press bit, kind, delay
	const units = storableDelay(step.delay) / DELAY_STEP_MS; // delay in 10 ms units
	view.setUint16(at, (step.press ? PRESS_BIT : 0) | (kind << KIND_SHIFT) | units, true); // step word
	view.setUint16(at + 2, data, true); // data bytes
}

/**
 * @brief Limit a number to a range.
 * @param[in] value Number to limit.
 * @param[in] min Lowest result.
 * @param[in] max Highest result.
 * @return value, or the nearer bound when outside.
 */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value)); // bounded value
}
