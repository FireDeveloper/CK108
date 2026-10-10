<script lang="ts">
	/**
	 * @file BackupPanel.svelte
	 * @brief Backup screen: save every setting to a JSON file, and restore chosen parts from one after previewing what it holds.
	 * @note Restoring writes the key maps of every profile but never switches the active profile.
	 */
	import { Download, FileUp, Upload } from '@lucide/svelte';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { PROFILES, sameEntry } from '#lib/ck108/keymap.ts';
	import { KEYS } from '#lib/ck108/layout.ts';
	import { MODES, hex16 } from '#lib/ck108/protocol.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import FileButton from '#lib/ui/FileButton.svelte';
	import { BackupError, backupFileName, parseBackup, serializeBackup, type Backup } from './backup.ts';

	interface Props {
		firmware: number;
		defaults: Uint8Array;
	}

	let { firmware, defaults }: Props = $props(); // this keyboard's firmware version and factory key map

	const DOWNLOAD_REVOKE_MS = 1000; // keep the download URL alive while the browser starts the download

	const connection = getConnection(); // shared connection from the layout
	let saving = $state(false); // backup read in flight
	let savedName = $state<string | null>(null); // file name of the last backup saved
	let loaded = $state.raw<{ fileName: string; backup: Backup } | null>(null); // backup file chosen for restore
	let loadError = $state<string | null>(null); // why the chosen file was refused
	let restoreLighting = $state(true); // restore the lighting settings
	let restoreKeyColors = $state(true); // restore the per-key colours
	let restoreKeys = $state(true); // restore every key map and the macros
	let confirming = $state(false); // restore awaits confirmation
	let restoring = $state(false); // restore in flight
	let restoredName = $state<string | null>(null); // file restored last

	const summary = $derived(loaded ? summarize(loaded.backup) : null); // preview of the chosen file
	const hasParts = $derived(restoreLighting || restoreKeyColors || restoreKeys); // something to restore

	/** @brief Read every setting from the keyboard and download it as a backup file. */
	async function save(): Promise<void> {
		saving = true; // block a second save
		savedName = null; // fresh status
		try {
			const backup = await connection.createBackup(); // fresh reads
			if (!backup) return; // read failed; the layout shows the error
			const fileName = backupFileName(new Date(backup.savedAt)); // dated name
			download(fileName, serializeBackup(backup)); // hand the file to the browser
			savedName = fileName; // confirm it
		} finally {
			saving = false; // ready again
		}
	}

	/**
	 * @brief Make the browser download text as a file.
	 * @param[in] fileName Suggested file name.
	 * @param[in] text File contents.
	 */
	function download(fileName: string, text: string): void {
		const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); // file in memory
		const link = document.createElement('a'); // detached download link
		link.href = url; // file to save
		link.download = fileName; // save instead of navigating
		link.click(); // start the download
		setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_MS); // free the memory once the download has started
	}

	/**
	 * @brief Read and check a backup file chosen for restore.
	 * @param[in] file File from the picker.
	 */
	async function load(file: File): Promise<void> {
		//- Reset the previous choice
		loaded = null; // no preview until the file checks out
		loadError = null; // fresh status
		confirming = false; // a new file needs a new confirmation
		restoredName = null; // stale result

		//- Parse and check
		try {
			loaded = { fileName: file.name, backup: parseBackup(await file.text()) }; // checked backup
		} catch (error) {
			loadError = error instanceof BackupError ? error.message : `The file could not be read: ${String(error)}`; // why it was refused
		}
	}

	/** @brief Write the chosen parts of the loaded backup. */
	async function restore(): Promise<void> {
		if (!loaded) return; // nothing loaded
		confirming = false; // confirmation used
		restoring = true; // block a second restore
		try {
			const parts = { lighting: restoreLighting, keyColors: restoreKeyColors, keysAndMacros: restoreKeys }; // chosen parts
			if (await connection.restore(loaded.backup, parts)) restoredName = loaded.fileName; // confirm success; failures show in the layout
		} finally {
			restoring = false; // ready again
		}
	}

	/**
	 * @brief Describe what a backup holds, for the preview.
	 * @param[in] backup Parsed backup.
	 * @return Display lines for each part.
	 */
	function summarize(backup: Backup) {
		const mode = backup.lighting[0]; // effect mode byte
		const litKeys = KEYS.filter((key) => backup.keyColors.subarray(key.led * 3, key.led * 3 + 3).some((channel) => channel !== 0)).length; // keys with a colour
		const remapped = Array.from({ length: PROFILES }, (_, profile) => KEYS.filter((key) => !sameEntry(backup.keymaps[profile], defaults, key.slot)).length); // changed keys per profile
		return {
			saved: backup.savedAt ? new Date(backup.savedAt).toLocaleString() : 'unknown time', // when it was read
			isOtherFirmware: backup.firmware !== firmware, // saved from different firmware
			firmware: `0x${hex16(backup.firmware)}`, // source firmware
			lighting: `${MODES[mode] ?? `Mode ${mode}`}, brightness ${backup.lighting[1]}`, // effect and brightness
			keyColors: `${litKeys} of ${KEYS.length} keys lit`, // custom effect colours
			keys: remapped.map((count, profile) => `profile ${profile + 1}: ${count === 0 ? 'factory' : `${count} changed`}`).join(', '), // remaps per profile
			macros: backup.macros.length === 0 ? 'none' : backup.macros.map((macro) => macro.name).join(', ') // macro names
		};
	}
</script>

<Card title="Save a backup">
	<p>Reads every setting from the keyboard and saves it as a file: lighting, key colours, the keys of all three profiles, and the macros.</p>
	<div class="actions">
		<Button variant="primary" disabled={saving} onclick={save}>
			<Download size={16} aria-hidden="true" />
			{saving ? 'Reading...' : 'Save backup file'}
		</Button>
	</div>
	{#if savedName}
		<p class="hint">Saved as {savedName} in your downloads.</p>
	{/if}
</Card>

<Card title="Restore from a backup">
	<p>Choose a backup file to see what it holds before anything is written.</p>
	<div class="actions">
		<FileButton accept=".json,application/json" disabled={restoring} onfile={load}>
			<FileUp size={16} aria-hidden="true" />
			Choose backup file
		</FileButton>
	</div>

	{#if loadError}
		<Alert tone="danger" title="This file cannot be restored">{loadError}</Alert>
	{/if}

	{#if loaded && summary}
		<dl>
			<dt>File</dt>
			<dd>{loaded.fileName}</dd>
			<dt>Saved</dt>
			<dd>{summary.saved}, firmware {summary.firmware}</dd>
		</dl>

		{#if summary.isOtherFirmware}
			<Alert tone="warn" title="Saved from different firmware">
				This keyboard runs firmware 0x{hex16(firmware)}. The settings may not mean the same thing on it.
			</Alert>
		{/if}

		<fieldset>
			<legend>Restore</legend>
			<div class="part">
				<Checkbox label="Lighting" checked={restoreLighting} onchange={(on) => (restoreLighting = on)} />
				<span class="detail">{summary.lighting}</span>
			</div>
			<div class="part">
				<Checkbox label="Key colours" checked={restoreKeyColors} onchange={(on) => (restoreKeyColors = on)} />
				<span class="detail">{summary.keyColors}</span>
			</div>
			<div class="part">
				<Checkbox label="Keys and macros" checked={restoreKeys} onchange={(on) => (restoreKeys = on)} />
				<span class="detail">Keys of {summary.keys}. Macros: {summary.macros}.</span>
			</div>
		</fieldset>
		<p class="hint">
			Keys and macros go together because keys refer to macros by number. Restoring replaces those settings on the keyboard; save a backup
			first if you may want them back. The keyboard stays on the profile it is using.
		</p>

		<div class="actions">
			{#if confirming}
				<span class="detail">Replace the chosen settings on the keyboard?</span>
				<Button variant="primary" onclick={restore}>
					<Upload size={16} aria-hidden="true" />
					Restore
				</Button>
				<Button onclick={() => (confirming = false)}>Cancel</Button>
			{:else}
				<Button variant="primary" disabled={!hasParts || restoring} onclick={() => (confirming = true)}>
					<Upload size={16} aria-hidden="true" />
					{restoring ? 'Restoring...' : 'Restore to keyboard'}
				</Button>
			{/if}
		</div>
	{/if}

	{#if restoredName}
		<p class="hint">Restored from {restoredName} and read back from the keyboard.</p>
	{/if}
</Card>

<style>
	p {
		margin: 0;
		max-width: 70ch;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 16px 0;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 20px;
		margin: 16px 0;
	}

	dt {
		color: var(--text-muted);
	}

	dd {
		margin: 0;
	}

	fieldset {
		display: grid;
		gap: 10px;
		margin: 16px 0 12px;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 10px;
		padding: 0;
		font-weight: 600;
	}

	.part {
		display: grid;
		gap: 2px;
	}

	.detail,
	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.part .detail {
		padding-left: 24px;
	}
</style>
