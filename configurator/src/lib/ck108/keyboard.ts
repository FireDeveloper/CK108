/**
 * @file keyboard.ts
 * @brief WebHID transport for the CK108 configuration collection: request/reply with timeout and retries, sessions, info, profile switch, lighting,
 *        per-key colour, key map and macro access.
 */

import {
	CHUNK_SIZE,
	Command,
	INFO_PROFILE,
	INFO_SIZE,
	KEY_COLORS_SIZE,
	LEDS_PER_CHUNK,
	LED_SLOTS,
	LIGHTING_SIZE,
	PRODUCT_ID,
	REPORT_ID,
	SESSION_END_DELAY_MS,
	STATUS_REJECTED,
	USAGE,
	USAGE_PAGE,
	VENDOR_ID,
	buildRequest,
	decodeInfo,
	decodeLighting,
	parseReply,
	type Info,
	type Lighting,
	type LightingField,
	type Reply
} from './protocol.ts';
import { KEYMAP_SIZE, PROFILES } from './keymap.ts';
import { HEADER_SIZE, MACRO_MAGIC } from './macros.ts';

//& Public Variables

export const TIMEOUT_MS = 1000; // reply wait per attempt, as in the vendor app
export const RETRIES = 3; // attempts per command, as in the vendor app

export const FILTER: HIDDeviceFilter = { vendorId: VENDOR_ID, productId: PRODUCT_ID, usagePage: USAGE_PAGE, usage: USAGE }; // picker shows only the configuration collection

//& Public Functions

/**
 * @brief Report whether this browser exposes WebHID.
 * @return True in Chromium browsers on a secure origin.
 */
export function isSupported(): boolean {
	return typeof navigator !== 'undefined' && 'hid' in navigator; // WebHID entry point present
}

/**
 * @brief Check that a HIDDevice is the CK108 configuration collection.
 * @param[in] device Device from requestDevice() or getDevices().
 * @return True for the vendor collection of a CK108.
 */
export function isConfigCollection(device: HIDDevice): boolean {
	const isCk108 = device.vendorId === VENDOR_ID && device.productId === PRODUCT_ID; // keyboard identity
	return isCk108 && device.collections.some((c) => c.usagePage === USAGE_PAGE && c.usage === USAGE); // vendor collection present
}

/** @brief Command rejected by the keyboard, or no reply within the retry budget. */
export class Ck108Error extends Error {}

/** @brief Open handle on one CK108; operations run one at a time in call order. */
export class Keyboard {
	readonly device: HIDDevice; // configuration collection
	#queue: Promise<unknown> = Promise.resolve(); // tail of the operation queue

	/**
	 * @brief Wrap a device the user has granted.
	 * @param[in] device CK108 configuration collection, see isConfigCollection().
	 */
	constructor(device: HIDDevice) {
		this.device = device; // keep the handle
	}

	/**
	 * @brief Show the browser device picker filtered to the CK108.
	 * @return The picked keyboard, or null when the picker is dismissed.
	 * @note Must run inside a user gesture such as a click handler.
	 */
	static async request(): Promise<Keyboard | null> {
		const devices = await navigator.hid.requestDevice({ filters: [FILTER] }); // user picks a device
		const device = devices.find(isConfigCollection); // configuration collection only
		return device ? new Keyboard(device) : null; // picked keyboard or nothing
	}

	/**
	 * @brief Find a CK108 the user granted on an earlier visit.
	 * @return The keyboard, or null when none is granted and plugged in.
	 */
	static async granted(): Promise<Keyboard | null> {
		const devices = await navigator.hid.getDevices(); // devices granted to this origin
		const device = devices.find(isConfigCollection); // configuration collection only
		return device ? new Keyboard(device) : null; // granted keyboard or nothing
	}

	/** @brief Open the collection; no-op when already open. */
	async open(): Promise<void> {
		if (!this.device.opened) await this.device.open(); // claim the collection
	}

	/** @brief Close the collection; no-op when already closed. */
	async close(): Promise<void> {
		if (this.device.opened) await this.device.close(); // release the collection
	}

	/**
	 * @brief Read the info block.
	 * @return Identity, firmware, active profile, macro space and supported modes.
	 * @throws Ck108Error The keyboard rejected the command or did not reply.
	 */
	readInfo(): Promise<Info> {
		return this.#exclusive(async () => decodeInfo((await this.#transfer(Command.readInfo, INFO_SIZE)).subarray(0, INFO_SIZE))); // outside a session, as the vendor app does
	}

	/**
	 * @brief Make a profile the active one: read the info block, change its profile byte and write the block back, as the vendor app does.
	 * @param[in] profile 0..PROFILES-1.
	 * @throws RangeError profile is out of range.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 * @note Lighting and per-key colours are shared by every profile; only the key map in use changes.
	 */
	setProfile(profile: number): Promise<void> {
		checkProfile(profile); // valid slot only
		return this.#exclusive(async () => {
			const block = (await this.#transfer(Command.readInfo, INFO_SIZE)).slice(0, INFO_SIZE); // current info block
			block[INFO_PROFILE] = profile; // new active profile
			await this.#transfer(Command.writeInfo, INFO_SIZE, 0, block); // whole block back, outside a session
		});
	}

	/**
	 * @brief Read the lighting block.
	 * @return Mode, levels, direction, rainbow flag and effect colour.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	async readLighting(): Promise<Lighting> {
		return decodeLighting(await this.readLightingBlock()); // fields the configurator shows
	}

	/**
	 * @brief Read the whole lighting block as stored.
	 * @return LIGHTING_SIZE bytes; LightingOffset names the known fields.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	readLightingBlock(): Promise<Uint8Array> {
		return this.#exclusive(() => this.#session(async () => (await this.#transfer(Command.readLighting, LIGHTING_SIZE)).slice(0, LIGHTING_SIZE))); // block read inside a session
	}

	/**
	 * @brief Write lighting fields in one session; the keyboard applies them on Command.end.
	 * @param[in] fields Field writes in send order, from byteField() or colorFields().
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	writeLighting(fields: readonly LightingField[]): Promise<void> {
		return this.#exclusive(() =>
			this.#session(async () => {
				for (const [offset, data] of fields) await this.#transfer(Command.writeLighting, data.length, offset, data); // one packet per field, as the vendor app sends them
			})
		);
	}

	/**
	 * @brief Read the per-key colour buffer shown by the custom effect.
	 * @return KEY_COLORS_SIZE bytes, R G B per LED index.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	readKeyColors(): Promise<Uint8Array> {
		return this.#exclusive(() =>
			this.#session(async () => {
				const colors = new Uint8Array(KEY_COLORS_SIZE); // whole buffer
				for (let led = 0; led < LED_SLOTS; led += LEDS_PER_CHUNK) { // one packet per chunk
					const chunk = await this.#transfer(Command.readKeyColors, LEDS_PER_CHUNK * 3, led * 3); // chunk colours
					colors.set(chunk.subarray(0, LEDS_PER_CHUNK * 3), led * 3); // place them
				}
				return colors; // full buffer
			})
		);
	}

	/**
	 * @brief Write the per-key colour buffer shown by the custom effect.
	 * @param[in] colors KEY_COLORS_SIZE bytes, R G B per LED index.
	 * @throws RangeError colors has the wrong length.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	writeKeyColors(colors: Uint8Array): Promise<void> {
		if (colors.length !== KEY_COLORS_SIZE) throw new RangeError(`need ${KEY_COLORS_SIZE} colour bytes, got ${colors.length}`); // full buffer only
		const copy = colors.slice(); // later edits by the caller do not leak into queued packets
		return this.#exclusive(() =>
			this.#session(async () => {
				for (let led = 0; led < LED_SLOTS; led += LEDS_PER_CHUNK) { // one packet per chunk
					const size = LEDS_PER_CHUNK * 3; // bytes per packet
					await this.#transfer(Command.writeKeyColors, size, led * 3, copy.slice(led * 3, led * 3 + size)); // chunk colours
				}
			})
		);
	}

	/**
	 * @brief Read one profile's key map.
	 * @param[in] profile 0..PROFILES-1.
	 * @return KEYMAP_SIZE bytes, one entry per matrix slot; see decodeAction().
	 * @throws RangeError profile is out of range.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	readKeymap(profile: number): Promise<Uint8Array> {
		checkProfile(profile); // valid slot only
		return this.#exclusive(() => this.#session(() => this.#readBlock(Command.readKeymap, profile * KEYMAP_SIZE, KEYMAP_SIZE))); // profile's block
	}

	/**
	 * @brief Read the factory key map the keyboard keeps for resets.
	 * @return KEYMAP_SIZE bytes, same layout as readKeymap().
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	readDefaultKeymap(): Promise<Uint8Array> {
		return this.#exclusive(() => this.#session(() => this.#readBlock(Command.readDefaultKeymap, 0, KEYMAP_SIZE))); // factory block
	}

	/**
	 * @brief Write one profile's key map; the keyboard applies it on Command.end.
	 * @param[in] profile 0..PROFILES-1.
	 * @param[in] map KEYMAP_SIZE bytes, see readKeymap().
	 * @throws RangeError profile is out of range or map has the wrong length.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	writeKeymap(profile: number, map: Uint8Array): Promise<void> {
		checkProfile(profile); // valid slot only
		if (map.length !== KEYMAP_SIZE) throw new RangeError(`need ${KEYMAP_SIZE} key map bytes, got ${map.length}`); // full map only
		const copy = map.slice(); // later edits by the caller do not leak into queued packets
		return this.#exclusive(() => this.#session(() => this.#writeBlock(Command.writeKeymap, profile * KEYMAP_SIZE, copy))); // profile's block
	}

	/**
	 * @brief Read the macro blob: its header first, then as many bytes as the header declares, as the vendor app does.
	 * @param[in] limit Largest blob to read, Info.macroSpace; a larger declared size is read only up to the header.
	 * @return The blob; just the header when the keyboard holds no macros. See decodeMacros().
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	readMacros(limit: number): Promise<Uint8Array> {
		return this.#exclusive(() =>
			this.#session(async () => {
				const header = await this.#readBlock(Command.readMacros, 0, HEADER_SIZE); // magic and declared size
				const view = new DataView(header.buffer); // little-endian reader
				const size = view.getUint16(2, true); // declared blob length
				const isStored = view.getUint16(0, true) === MACRO_MAGIC && size > HEADER_SIZE && size <= limit; // a plausible blob with records
				return isStored ? this.#readBlock(Command.readMacros, 0, size) : header; // whole blob, or the header alone
			})
		);
	}

	/**
	 * @brief Write the macro blob, then key maps, in one session, as the vendor Apply does.
	 * @param[in] blob Blob from packMacros().
	 * @param[in] keymaps Profile -> KEYMAP_SIZE bytes, for the profiles whose macro references changed; may be empty.
	 * @throws RangeError A profile is out of range or a key map has the wrong length.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	writeMacros(blob: Uint8Array, keymaps: ReadonlyMap<number, Uint8Array>): Promise<void> {
		//- Input validation
		for (const [profile, map] of keymaps) { // every key map to write
			checkProfile(profile); // valid slot only
			if (map.length !== KEYMAP_SIZE) throw new RangeError(`need ${KEYMAP_SIZE} key map bytes, got ${map.length}`); // full map only
		}

		//- One session: blob first, then key maps
		const [blobCopy, mapCopies] = [blob.slice(), [...keymaps].map(([profile, map]) => [profile, map.slice()] as const)]; // later edits by the caller do not leak in
		return this.#exclusive(() =>
			this.#session(async () => {
				await this.#writeBlock(Command.writeMacros, 0, blobCopy); // macro blob from offset 0
				for (const [profile, map] of mapCopies) await this.#writeBlock(Command.writeKeymap, profile * KEYMAP_SIZE, map); // each changed profile
			})
		);
	}

	/**
	 * @brief Run an operation after every earlier one settles.
	 * @param[in] operation Commands that must not interleave with another operation's packets.
	 * @return The operation's result.
	 */
	#exclusive<T>(operation: () => Promise<T>): Promise<T> {
		const run = this.#queue.then(operation, operation); // start once the previous operation settles
		this.#queue = run.catch(() => undefined); // a failure does not block later operations
		return run; // caller sees this operation's outcome
	}

	/**
	 * @brief Wrap commands in Command.begin ... Command.end, as the vendor app does.
	 * @param[in] body Commands to run inside the session.
	 * @return The body's result.
	 * @note Command.end is sent even when the body throws.
	 */
	async #session<T>(body: () => Promise<T>): Promise<T> {
		await this.#transfer(Command.begin); // open the session
		try {
			return await body(); // caller's commands
		} finally {
			await new Promise((resolve) => setTimeout(resolve, SESSION_END_DELAY_MS)); // vendor app pauses before closing
			await this.#transfer(Command.end); // close the session
		}
	}

	/**
	 * @brief Read a block with one command per CHUNK_SIZE chunk; the caller wraps it in a session.
	 * @param[in] command Read command.
	 * @param[in] base Offset of the first byte.
	 * @param[in] size Total length in bytes.
	 * @return The block.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	async #readBlock(command: number, base: number, size: number): Promise<Uint8Array> {
		const block = new Uint8Array(size); // whole block
		for (let offset = 0; offset < size; offset += CHUNK_SIZE) { // one packet per chunk
			const length = Math.min(CHUNK_SIZE, size - offset); // last chunk is short
			block.set((await this.#transfer(command, length, base + offset)).subarray(0, length), offset); // place the chunk
		}
		return block; // full block
	}

	/**
	 * @brief Write a block with one command per CHUNK_SIZE chunk; the caller wraps it in a session.
	 * @param[in] command Write command.
	 * @param[in] base Offset of the first byte.
	 * @param[in] data Bytes to write.
	 * @throws Ck108Error The keyboard rejected a command or did not reply.
	 */
	async #writeBlock(command: number, base: number, data: Uint8Array): Promise<void> {
		for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) { // one packet per chunk
			const chunk = data.slice(offset, offset + CHUNK_SIZE); // chunk bytes, last chunk short
			await this.#transfer(command, chunk.length, base + offset, chunk); // write the chunk
		}
	}

	/**
	 * @brief Send one command and return its reply payload.
	 * @param[in] command Command byte.
	 * @param[in] length Length field, 0..CHUNK_SIZE.
	 * @param[in] offset Offset field.
	 * @param[in] payload Request payload.
	 * @return Reply payload, CHUNK_SIZE bytes.
	 * @throws Ck108Error Every attempt timed out or came back with a STATUS_REJECTED status.
	 */
	async #transfer(command: number, length = 0, offset = 0, payload?: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
		const request = buildRequest(command, length, offset, payload); // framed request
		let failure = 'no reply'; // why the last attempt failed
		for (let attempt = 0; attempt < RETRIES; attempt++) { // vendor app retry budget
			const reply = await this.#exchange(command, request); // one send and wait
			if (reply && !STATUS_REJECTED.includes(reply.status)) return reply.payload.subarray(0, CHUNK_SIZE); // accepted
			failure = reply ? `status 0x${reply.status.toString(16)}` : 'no reply'; // remember the cause and retry
		}
		throw new Ck108Error(`command 0x${command.toString(16).padStart(2, '0')} failed: ${failure}`); // retries exhausted
	}

	/**
	 * @brief Send a request and wait for the reply that echoes its command.
	 * @param[in] command Command byte the reply must echo.
	 * @param[in] request Framed request from buildRequest().
	 * @return The reply, or null after TIMEOUT_MS.
	 * @throws DOMException sendReport() failed, e.g. the keyboard was unplugged.
	 */
	#exchange(command: number, request: Uint8Array<ArrayBuffer>): Promise<Reply | null> {
		return new Promise((resolve, reject) => {
			//- Reply matching and cleanup
			const settle = () => {
				clearTimeout(timer); // stop the timeout
				this.device.removeEventListener('inputreport', onReport); // stop listening
			};
			const onReport = (event: HIDInputReportEvent) => {
				if (event.reportId !== REPORT_ID) return; // not a configuration reply
				const reply = parseReply(event.data); // header and payload
				if (reply.command !== command) return; // reply to something else
				settle(); // done waiting
				resolve(reply); // hand back the reply
			};
			const timer = setTimeout(() => {
				settle(); // give up on this attempt
				resolve(null); // report the timeout
			}, TIMEOUT_MS);

			//- Listen first, then send
			this.device.addEventListener('inputreport', onReport); // catch the reply
			this.device.sendReport(REPORT_ID, request).catch((error: unknown) => {
				settle(); // no reply is coming
				reject(error); // surface the send failure
			});
		});
	}
}

//& Private Functions

/**
 * @brief Reject a profile number outside the hardware slots.
 * @param[in] profile Profile number to check.
 * @throws RangeError profile is not 0..PROFILES-1.
 */
function checkProfile(profile: number): void {
	if (!Number.isInteger(profile) || profile < 0 || profile >= PROFILES) throw new RangeError(`profile ${profile} not in 0..${PROFILES - 1}`); // reject
}
