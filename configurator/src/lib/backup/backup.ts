/**
 * @file backup.ts
 * @brief Backup file format: every setting of one keyboard as JSON, with byte blocks as hex and macros as readable objects; serialise, parse and validate.
 * @note A file names the profile that was active when it was saved, but restoring never switches profiles.
 */

import { KEYMAP_SIZE, PROFILES } from '#lib/ck108/keymap.ts';
import { CYCLES_MAX, DELAY_MAX_MS, MACRO_LIMIT, STEP_LIMIT, type Macro, type MacroStep, type StepTarget } from '#lib/ck108/macros.ts';
import { KEY_COLORS_SIZE, LIGHTING_SIZE } from '#lib/ck108/protocol.ts';

//& Public Variables

export const BACKUP_FORMAT = 'ck108-backup'; // format tag in every file
export const BACKUP_VERSION = 1; // layout version this code writes and reads

/** @brief Every setting read from one keyboard. */
export interface Backup {
	savedAt: string;
	firmware: number;
	activeProfile: number;
	lighting: Uint8Array;
	keyColors: Uint8Array;
	keymaps: Uint8Array[];
	macros: Macro[];
}

/** @brief A backup file that cannot be read; the message names the field at fault. */
export class BackupError extends Error {}

//& Public Functions

/**
 * @brief Serialise a backup as the JSON text of a backup file.
 * @param[in] backup Settings to save.
 * @return Indented JSON.
 */
export function serializeBackup(backup: Backup): string {
	return JSON.stringify(
		{
			format: BACKUP_FORMAT, // format tag
			version: BACKUP_VERSION, // layout version
			savedAt: backup.savedAt, // ISO time of the read
			firmware: backup.firmware, // firmware version of the source keyboard
			activeProfile: backup.activeProfile, // 0-based, index into keymaps
			lighting: toHex(backup.lighting), // whole lighting block
			keyColors: toHex(backup.keyColors), // per-key colours, R G B per LED
			keymaps: backup.keymaps.map(toHex), // one key map per profile
			macros: backup.macros // readable macros
		},
		null,
		2
	); // file text
}

/**
 * @brief Parse and check the JSON text of a backup file.
 * @param[in] text File contents.
 * @return The backup.
 * @throws BackupError The text is not a version-1 CK108 backup, or a field is missing or out of range.
 */
export function parseBackup(text: string): Backup {
	//- JSON and format tag
	let file: unknown; // parsed JSON
	try {
		file = JSON.parse(text); // whole file
	} catch {
		throw new BackupError('The file is not JSON, so it is not a CK108 backup.'); // not JSON at all
	}
	const root = record(file, 'file'); // top-level object
	if (root.format !== BACKUP_FORMAT) throw new BackupError('The file is not a CK108 backup.'); // some other JSON
	if (root.version !== BACKUP_VERSION) throw new BackupError(`The backup has version ${String(root.version)}; this page reads version ${BACKUP_VERSION}.`); // other layout

	//- Fields
	const keymaps = list(root.keymaps, 'keymaps'); // per-profile hex strings
	if (keymaps.length !== PROFILES) throw new BackupError(`keymaps must hold ${PROFILES} profiles, not ${keymaps.length}.`); // wrong profile count
	const macros = list(root.macros, 'macros'); // macro objects
	if (macros.length > MACRO_LIMIT) throw new BackupError(`macros holds ${macros.length} macros; at most ${MACRO_LIMIT} fit.`); // too many macros
	return {
		savedAt: typeof root.savedAt === 'string' ? root.savedAt : '', // informational only
		firmware: integer(root.firmware, 'firmware', 0, 0xffff), // source firmware
		activeProfile: integer(root.activeProfile, 'activeProfile', 0, PROFILES - 1), // informational only
		lighting: fromHex(root.lighting, LIGHTING_SIZE, 'lighting'), // whole lighting block
		keyColors: fromHex(root.keyColors, KEY_COLORS_SIZE, 'keyColors'), // per-key colours
		keymaps: keymaps.map((map, profile) => fromHex(map, KEYMAP_SIZE, `keymaps[${profile}]`)), // key maps
		macros: macros.map((macro, index) => parseMacro(macro, `macros[${index}]`)) // checked macros
	};
}

/**
 * @brief File name for a backup saved at a given time.
 * @param[in] date Save time.
 * @return "ck108-backup-YYYY-MM-DD-HHMM.json" in local time.
 */
export function backupFileName(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0'); // two digits
	return `ck108-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`; // sortable name
}

//& Private Functions

/**
 * @brief Check and convert one macro object.
 * @param[in] value Parsed JSON value.
 * @param[in] path Field path for error messages.
 * @return The macro.
 * @throws BackupError A field is missing or out of range.
 */
function parseMacro(value: unknown, path: string): Macro {
	const macro = record(value, path); // macro object
	if (typeof macro.name !== 'string') throw new BackupError(`${path}.name must be text.`); // bad name
	const steps = list(macro.steps, `${path}.steps`); // step objects
	if (steps.length > STEP_LIMIT) throw new BackupError(`${path} has ${steps.length} steps; at most ${STEP_LIMIT} fit.`); // too many steps
	return {
		name: macro.name, // macro name
		cycles: integer(macro.cycles, `${path}.cycles`, 1, CYCLES_MAX), // plays per key press
		steps: steps.map((step, index) => parseStep(step, `${path}.steps[${index}]`)) // checked steps
	};
}

/**
 * @brief Check and convert one macro step object.
 * @param[in] value Parsed JSON value.
 * @param[in] path Field path for error messages.
 * @return The step.
 * @throws BackupError A field is missing or out of range.
 */
function parseStep(value: unknown, path: string): MacroStep {
	const step = record(value, path); // step object
	if (typeof step.press !== 'boolean') throw new BackupError(`${path}.press must be true or false.`); // bad direction
	return { press: step.press, target: parseTarget(step.target, `${path}.target`), delay: integer(step.delay, `${path}.delay`, 0, DELAY_MAX_MS) }; // checked step
}

/**
 * @brief Check and convert one step target object.
 * @param[in] value Parsed JSON value.
 * @param[in] path Field path for error messages.
 * @return The target.
 * @throws BackupError The page is unknown or a value is out of range.
 */
function parseTarget(value: unknown, path: string): StepTarget {
	const target = record(value, path); // target object
	switch (target.page) {
		case 'key':
		case 'media':
		case 'system':
			return { page: target.page, usage: integer(target.usage, `${path}.usage`, 0, 0xffff) }; // usage on a known page
		case 'raw': {
			const data = list(target.data, `${path}.data`); // stored data bytes
			if (data.length !== 2) throw new BackupError(`${path}.data must hold 2 bytes.`); // wrong length
			return { page: 'raw', kind: integer(target.kind, `${path}.kind`, 0, 7), data: [integer(data[0], `${path}.data[0]`, 0, 0xff), integer(data[1], `${path}.data[1]`, 0, 0xff)] }; // undecoded step
		}
		default:
			throw new BackupError(`${path}.page must be key, media, system or raw.`); // unknown page
	}
}

/**
 * @brief Require a JSON object.
 * @param[in] value Parsed JSON value.
 * @param[in] path Field path for error messages.
 * @return The object's fields.
 * @throws BackupError value is not an object.
 */
function record(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BackupError(`${path} must be an object.`); // wrong type
	return value as Record<string, unknown>; // fields
}

/**
 * @brief Require a JSON array.
 * @param[in] value Parsed JSON value.
 * @param[in] path Field path for error messages.
 * @return The array.
 * @throws BackupError value is not an array.
 */
function list(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) throw new BackupError(`${path} must be a list.`); // wrong type
	return value; // items
}

/**
 * @brief Require a whole number in a range.
 * @param[in] value Parsed JSON value.
 * @param[in] path Field path for error messages.
 * @param[in] min Lowest allowed value.
 * @param[in] max Highest allowed value.
 * @return The number.
 * @throws BackupError value is not a whole number from min to max.
 */
function integer(value: unknown, path: string, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new BackupError(`${path} must be a whole number from ${min} to ${max}.`); // out of range
	return value; // checked number
}

/**
 * @brief Format bytes as lowercase hex without separators.
 * @param[in] bytes Bytes to format.
 * @return Two hex digits per byte.
 */
function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); // packed hex
}

/**
 * @brief Parse a hex string of a known byte length.
 * @param[in] value Parsed JSON value.
 * @param[in] size Expected byte length.
 * @param[in] path Field path for error messages.
 * @return The bytes.
 * @throws BackupError value is not hex text of exactly size bytes.
 */
function fromHex(value: unknown, size: number, path: string): Uint8Array<ArrayBuffer> {
	if (typeof value !== 'string' || value.length !== size * 2 || !/^[0-9a-f]*$/i.test(value)) throw new BackupError(`${path} must be ${size} bytes of hex.`); // wrong shape
	return Uint8Array.from({ length: size }, (_, index) => parseInt(value.slice(index * 2, index * 2 + 2), 16)); // byte per digit pair
}
