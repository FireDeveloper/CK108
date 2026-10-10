/**
 * @file connection.svelte.ts
 * @brief Reactive CK108 connection shared through context: WebHID detection, connect, reattach on plug-in, profile switch, lighting, per-key colour, key map
 *        and macro changes, backup and restore, and the last reads.
 */

import { createContext } from 'svelte';
import { Keyboard, isConfigCollection, isSupported } from './keyboard.ts';
import type { Backup } from '#lib/backup/backup.ts';
import { PROFILES } from './keymap.ts';
import { decodeMacros, packMacros, type Macro, type PackedMacros } from './macros.ts';
import { LIGHTING_SETTINGS_SIZE, type Info, type Lighting, type LightingField } from './protocol.ts';

//& Public Variables

/** @brief Connection lifecycle as the UI shows it. */
export type Status = 'checking' | 'unsupported' | 'disconnected' | 'connecting' | 'connected';

/** @brief Parts of a backup that Connection.restore() writes. */
export interface RestoreParts {
	lighting: boolean;
	keyColors: boolean;
	keysAndMacros: boolean;
}

//& Public Functions

/** @brief Connection state and actions; one instance per app, created in the root layout. */
export class Connection {
	status = $state<Status>('checking'); // lifecycle stage
	info = $state.raw<Info | null>(null); // last info block read
	lighting = $state.raw<Lighting | null>(null); // last lighting block read
	keyColors = $state.raw<Uint8Array | null>(null); // last per-key colour buffer read, R G B per LED
	keymaps = $state.raw<readonly Uint8Array[] | null>(null); // last key map read of every profile
	defaultKeymap = $state.raw<Uint8Array | null>(null); // factory key map
	macros = $state.raw<readonly Macro[] | null>(null); // last macros read, in stored order
	hasMacroNames = $state(true); // false when the keyboard holds the macros without their names
	error = $state<string | null>(null); // last failure shown to the user
	pending = $state(0); // writes in flight
	#keyboard: Keyboard | null = null; // open keyboard, if any

	/**
	 * @brief Detect WebHID, reattach a keyboard granted on an earlier visit, and follow plug and unplug events.
	 * @return Cleanup that removes the listeners and closes the keyboard.
	 * @note Call from an $effect: it reads navigator, which exists only in the browser.
	 */
	start(): () => void {
		//- Browser support
		if (!isSupported()) { // no WebHID
			this.status = 'unsupported'; // tell the user why nothing works
			return () => {}; // nothing to clean up
		}
		this.status = 'disconnected'; // ready for a connect

		//- Plug and unplug
		const onConnect = (event: HIDConnectionEvent) => {
			if (isConfigCollection(event.device) && this.status === 'disconnected') void this.#attach(new Keyboard(event.device)); // granted keyboard plugged back in
		};
		const onDisconnect = (event: HIDConnectionEvent) => {
			if (event.device === this.#keyboard?.device) this.#detach(); // our keyboard unplugged
		};
		navigator.hid.addEventListener('connect', onConnect); // follow plug-in
		navigator.hid.addEventListener('disconnect', onDisconnect); // follow unplug

		//- Earlier grant
		void Keyboard.granted().then((keyboard) => keyboard && this.#attach(keyboard)); // reattach without the picker

		return () => {
			navigator.hid.removeEventListener('connect', onConnect); // stop following plug-in
			navigator.hid.removeEventListener('disconnect', onDisconnect); // stop following unplug
			void this.disconnect(); // release the keyboard
		};
	}

	/**
	 * @brief Show the device picker and open the chosen keyboard.
	 * @note Call from a click handler: the picker needs a user gesture.
	 */
	async connect(): Promise<void> {
		this.error = null; // clear the previous failure
		try {
			const keyboard = await Keyboard.request(); // device picker
			if (keyboard) await this.#attach(keyboard); // open unless the picker was dismissed
		} catch (error) {
			this.error = describe(error); // picker or permission failure
		}
	}

	/** @brief Close the keyboard and forget the last reads; the grant stays, so the next visit reattaches. */
	async disconnect(): Promise<void> {
		const keyboard = this.#keyboard; // handle to close
		this.#detach(); // UI shows disconnected at once
		await keyboard?.close(); // release the collection
	}

	/** @brief Read the info block, lighting block, per-key colours, every profile's key map, the factory key map and the macros again. */
	async refresh(): Promise<void> {
		const keyboard = this.#keyboard; // open keyboard
		if (!keyboard) return; // nothing to read
		this.error = null; // clear the previous failure
		try {
			this.info = await keyboard.readInfo(); // identity, firmware, profile, modes
			this.lighting = await keyboard.readLighting(); // current effect
			this.keyColors = await keyboard.readKeyColors(); // custom effect colours
			this.defaultKeymap = await keyboard.readDefaultKeymap(); // factory key map
			const keymaps: Uint8Array[] = []; // every profile, in profile order
			for (let profile = 0; profile < PROFILES; profile++) keymaps.push(await keyboard.readKeymap(profile)); // one profile at a time
			this.keymaps = keymaps; // publish them together
			this.#publishMacros(await keyboard.readMacros(this.info.macroSpace)); // stored macros
		} catch (error) {
			this.error = describe(error); // command failure
		}
	}

	/**
	 * @brief Show a new active profile at once, switch the keyboard to it, then read the info block back so the UI shows the profile in use.
	 * @param[in] profile 0..PROFILES-1.
	 */
	async setProfile(profile: number): Promise<void> {
		const keyboard = this.#keyboard; // open keyboard
		const previous = this.info; // info block shown before the switch
		if (!keyboard || !previous) return; // nothing to switch
		this.error = null; // clear the previous failure
		this.info = { ...previous, profile }; // show the change before the write lands
		this.pending++; // write in flight
		try {
			await keyboard.setProfile(profile); // info block with the new profile
			const stored = await keyboard.readInfo(); // keyboard's info block after the write
			if (this.info) this.info = stored; // show the profile in use, unless it was unplugged meanwhile
		} catch (error) {
			if (this.info) this.info = previous; // back to the last profile read
			this.error = describe(error); // command failure
		} finally {
			this.pending--; // write settled
		}
	}

	/**
	 * @brief Write lighting fields, then read the lighting block back so the UI shows what the keyboard holds.
	 * @param[in] fields Field writes in send order, from byteField() or colorFields().
	 */
	async applyLighting(fields: readonly LightingField[]): Promise<void> {
		const keyboard = this.#keyboard; // open keyboard
		if (!keyboard) return; // nothing to write to
		this.error = null; // clear the previous failure
		this.pending++; // write in flight
		try {
			await keyboard.writeLighting(fields); // send the change
			this.lighting = await keyboard.readLighting(); // keyboard's state after the write
		} catch (error) {
			this.error = describe(error); // command failure
		} finally {
			this.pending--; // write settled
		}
	}

	/**
	 * @brief Show new per-key colours at once, write them, then read the buffer back so the UI shows what the keyboard holds.
	 * @param[in] colors KEY_COLORS_SIZE bytes, R G B per LED; the caller must not modify it afterwards.
	 */
	async applyKeyColors(colors: Uint8Array): Promise<void> {
		const keyboard = this.#keyboard; // open keyboard
		if (!keyboard) return; // nothing to write to
		this.error = null; // clear the previous failure
		this.keyColors = colors; // show the change before the write lands
		this.pending++; // write in flight
		try {
			await keyboard.writeKeyColors(colors); // send the buffer
			this.keyColors = await keyboard.readKeyColors(); // keyboard's buffer after the write
		} catch (error) {
			this.error = describe(error); // command failure
		} finally {
			this.pending--; // write settled
		}
	}

	/**
	 * @brief Show a profile's new key map at once, write it, then read it back so the UI shows what the keyboard holds.
	 * @param[in] profile 0..PROFILES-1.
	 * @param[in] map KEYMAP_SIZE bytes; the caller must not modify it afterwards.
	 */
	async applyKeymap(profile: number, map: Uint8Array): Promise<void> {
		const keyboard = this.#keyboard; // open keyboard
		if (!keyboard || !this.keymaps) return; // nothing to write to
		this.error = null; // clear the previous failure
		this.keymaps = this.keymaps.with(profile, map); // show the change before the write lands
		this.pending++; // write in flight
		try {
			await keyboard.writeKeymap(profile, map); // send the map
			const stored = await keyboard.readKeymap(profile); // keyboard's map after the write
			if (this.keymaps) this.keymaps = this.keymaps.with(profile, stored); // show what the keyboard holds, unless it was unplugged meanwhile
		} catch (error) {
			this.error = describe(error); // command failure
		} finally {
			this.pending--; // write settled
		}
	}

	/**
	 * @brief Show new macros at once, write them with the key maps whose macro references changed, then read both back.
	 * @param[in] macros Every macro, in the order key map entries refer to them.
	 * @param[in] keymaps Profile -> new key map, for the profiles that must change with the macros; may be empty.
	 * @return True when the keyboard took the change; false when it did not fit or a command failed, with error set.
	 */
	async applyMacros(macros: readonly Macro[], keymaps: ReadonlyMap<number, Uint8Array> = new Map()): Promise<boolean> {
		//- Fit the blob before touching anything
		const keyboard = this.#keyboard; // open keyboard
		if (!keyboard || !this.info || !this.keymaps) return false; // nothing to write to
		this.error = null; // clear the previous failure
		let packed; // blob to write
		try {
			packed = packMacros(macros, this.info.macroSpace); // blob, names dropped if only that fits
		} catch (error) {
			this.error = describe(error); // too big or over a limit
			return false; // keyboard untouched
		}

		//- Show, write, read back
		this.macros = macros; // show the change before the write lands
		this.hasMacroNames = packed.hasNames; // whether names survive the write
		for (const [profile, map] of keymaps) this.keymaps = this.keymaps.with(profile, map); // matching key maps
		this.pending++; // write in flight
		try {
			await keyboard.writeMacros(packed.blob, keymaps); // blob, then key maps
			this.#publishMacros(await keyboard.readMacros(this.info.macroSpace)); // keyboard's macros after the write
			for (const profile of keymaps.keys()) {
				const stored = await keyboard.readKeymap(profile); // keyboard's map after the write
				if (this.keymaps) this.keymaps = this.keymaps.with(profile, stored); // show what the keyboard holds, unless it was unplugged meanwhile
			}
			return true; // written
		} catch (error) {
			this.error = describe(error); // command failure
			return false; // state may be partly written; the read-back shows it
		} finally {
			this.pending--; // write settled
		}
	}

	/**
	 * @brief Read every setting fresh from the keyboard, for a backup file.
	 * @return The settings, or null when no keyboard is open or a read failed, with error set.
	 */
	async createBackup(): Promise<Backup | null> {
		//- Needs an open keyboard and its info block
		const keyboard = this.#keyboard; // open keyboard
		const info = this.info; // firmware, active profile, macro space
		if (!keyboard || !info) return null; // nothing to read
		this.error = null; // clear the previous failure

		//- Fresh reads of every block
		try {
			const lighting = await keyboard.readLightingBlock(); // whole lighting block
			const keyColors = await keyboard.readKeyColors(); // per-key colours
			const keymaps: Uint8Array[] = []; // every profile, in profile order
			for (let profile = 0; profile < PROFILES; profile++) keymaps.push(await keyboard.readKeymap(profile)); // one profile at a time
			const macros = decodeMacros(await keyboard.readMacros(info.macroSpace)); // stored macros
			return { savedAt: new Date().toISOString(), firmware: info.firmware, activeProfile: info.profile, lighting, keyColors, keymaps, macros }; // backup
		} catch (error) {
			this.error = describe(error); // command failure
			return null; // no backup
		}
	}

	/**
	 * @brief Write chosen parts of a backup, then read every setting back so the UI shows what the keyboard holds.
	 * @param[in] backup Parsed backup file.
	 * @param[in] parts Which parts to write.
	 * @return True when every chosen part was written; false otherwise, with error set.
	 * @note Lighting restores the leading LIGHTING_SETTINGS_SIZE bytes, as the vendor Default button writes them; the rest of the block stays as it is.
	 * @note Keys and macros are written together, in one session, because key map entries refer to macros by position.
	 */
	async restore(backup: Backup, parts: RestoreParts): Promise<boolean> {
		//- Fit the macros before touching anything
		const keyboard = this.#keyboard; // open keyboard
		const info = this.info; // macro space
		if (!keyboard || !info) return false; // nothing to write to
		this.error = null; // clear the previous failure
		let packed: PackedMacros | null = null; // macro blob to write, if any
		try {
			if (parts.keysAndMacros) packed = packMacros(backup.macros, info.macroSpace); // blob, names dropped if only that fits
		} catch (error) {
			this.error = describe(error); // too big or over a limit
			return false; // keyboard untouched
		}

		//- Write the chosen parts, stopping at the first failure
		let failure: string | null = null; // first write failure
		this.pending++; // writes in flight
		try {
			if (parts.lighting) await keyboard.writeLighting([[0, backup.lighting.slice(0, LIGHTING_SETTINGS_SIZE)]]); // lighting settings in one packet
			if (parts.keyColors) await keyboard.writeKeyColors(backup.keyColors); // per-key colours
			if (packed) await keyboard.writeMacros(packed.blob, new Map(backup.keymaps.map((map, profile) => [profile, map]))); // macros, then every key map
		} catch (error) {
			failure = describe(error); // command failure; later parts are skipped
		} finally {
			this.pending--; // writes settled
		}

		//- Show what the keyboard holds now
		await this.refresh(); // every block read back
		if (failure) this.error = failure; // the write failure outranks a clean read-back
		return failure === null; // all chosen parts written
	}

	/**
	 * @brief Decode a macro blob read from the keyboard and show it.
	 * @param[in] blob Bytes from Keyboard.readMacros().
	 * @throws RangeError The blob is damaged; see decodeMacros().
	 */
	#publishMacros(blob: Uint8Array): void {
		this.macros = decodeMacros(blob); // stored macros
		this.hasMacroNames = blob.length < 8 || blob[6] !== 0 || this.macros.length === 0; // names flag, true when nothing is stored
	}

	/**
	 * @brief Open a keyboard, make it current and read its state.
	 * @param[in] keyboard Granted keyboard.
	 */
	async #attach(keyboard: Keyboard): Promise<void> {
		//- Open the collection
		this.status = 'connecting'; // busy
		this.error = null; // clear the previous failure
		try {
			await keyboard.open(); // claim the collection
		} catch {
			this.status = 'disconnected'; // back to idle
			this.error = 'Could not open the keyboard. Close the MotoSpeed app or any other tool using it, then connect again.'; // likely held elsewhere
			return; // stay disconnected
		}

		//- Make it current and read its state
		this.#keyboard = keyboard; // current keyboard
		this.status = 'connected'; // ready
		await this.refresh(); // first read
	}

	/** @brief Drop the current keyboard and its reads. */
	#detach(): void {
		this.#keyboard = null; // no current keyboard
		this.info = null; // forget the info block
		this.lighting = null; // forget the lighting block
		this.keyColors = null; // forget the per-key colours
		this.keymaps = null; // forget the key maps
		this.defaultKeymap = null; // forget the factory key map
		this.macros = null; // forget the macros
		this.status = 'disconnected'; // idle
	}
}

export const [getConnection, setConnection] = createContext<Connection>(); // typed context accessors

//& Private Functions

/**
 * @brief Turn a thrown value into a message for the user.
 * @param[in] error Anything thrown.
 * @return The error message, or the value as text.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error); // readable text
}
