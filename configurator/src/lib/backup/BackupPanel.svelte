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
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import FieldGroup from '#lib/ui/FieldGroup.svelte';
	import FileButton from '#lib/ui/FileButton.svelte';
	import Hint from '#lib/ui/Hint.svelte';
	import KeyValueList from '#lib/ui/KeyValueList.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
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

	/** @brief Write the chosen parts of the loaded backup; called once the user confirms. */
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
		const remapped = Array.from({ length: PROFILES }, (_, profile) => KEYS.filter((key) => !sameEntry(backup.keymaps[profile], defaults, key.slot)).length); // changed keys per profile
		return {
			saved: backup.savedAt ? new Date(backup.savedAt).toLocaleString() : 'unknown time', // when it was read
			isOtherFirmware: backup.firmware !== firmware, // saved from different firmware
			firmware: `0x${hex16(backup.firmware)}`, // source firmware
			lighting: perProfile(backup.lighting, (record) => `${MODES[record[0]] ?? `Mode ${record[0]}`}, brightness ${record[1]}`), // effect and brightness
			keyColors: perProfile(backup.keyColors, (colors) => `${litKeys(colors)} of ${KEYS.length} keys lit`), // custom effect colours
			keys: remapped.map((count, profile) => `profile ${profile + 1}: ${count === 0 ? 'factory' : `${count} changed`}`).join(', '), // remaps per profile
			macros: backup.macros.length === 0 ? 'none' : backup.macros.map((macro) => macro.name).join(', ') // macro names
		};
	}

	/**
	 * @brief Describe one part of a backup profile by profile, for the preview.
	 * @param[in] blocks One block per profile.
	 * @param[in] describe Text for one profile's block.
	 * @return "Profile 1: ...; profile 2: ...".
	 */
	function perProfile(blocks: readonly Uint8Array[], describe: (block: Uint8Array) => string): string {
		const parts = blocks.map((block, profile) => `${profile === 0 ? 'Profile' : 'profile'} ${profile + 1}: ${describe(block)}`); // one phrase per profile
		return parts.join('; '); // one sentence
	}

	/**
	 * @brief Count the drawn keys that have a colour in a per-key buffer.
	 * @param[in] colors KEY_COLORS_SIZE bytes, R G B per LED.
	 * @return Keys whose colour is not black.
	 */
	function litKeys(colors: Uint8Array): number {
		return KEYS.filter((key) => colors.subarray(key.led * 3, key.led * 3 + 3).some((channel) => channel !== 0)).length; // keys with a colour
	}
</script>

{#snippet restoreFooter()}
	<Button variant="primary" disabled={!hasParts || restoring} onclick={() => (confirming = true)}>
		{#if restoring}<Spinner />{:else}<Upload aria-hidden="true" />{/if}
		{restoring ? 'Restoring...' : 'Restore to keyboard'}
	</Button>
{/snippet}

<div class="backup">
	<Card title="Save a backup" description="Reads every setting from the keyboard and saves it as a file.">
		<KeyValueList
			items={[
				{ term: 'Lighting', detail: 'Effect, brightness, speed, direction and colours of every profile' },
				{ term: 'Key colours', detail: 'The colour of every key for Custom backlit mode, in every profile' },
				{ term: 'Keys', detail: 'The key map of every profile' },
				{ term: 'Macros', detail: 'Every stored macro with its steps' }
			]}
		/>
		{#if savedName}
			<Alert tone="ok" title="Backup saved">Saved as {savedName} in your downloads.</Alert>
		{/if}

		{#snippet footer()}
			<Button variant="primary" disabled={saving} onclick={save}>
				{#if saving}<Spinner />{:else}<Download aria-hidden="true" />{/if}
				{saving ? 'Reading...' : 'Save backup file'}
			</Button>
		{/snippet}
	</Card>

	<Card title="Restore from a backup" description="Choose a backup file to see what it holds before anything is written." footer={loaded ? restoreFooter : undefined}>
		<div>
			<FileButton accept=".json,application/json" disabled={restoring} onfile={load}>
				<FileUp aria-hidden="true" />
				Choose backup file
			</FileButton>
		</div>

		{#if loadError}
			<Alert tone="danger" title="This file cannot be restored">{loadError}</Alert>
		{/if}

		{#if loaded && summary}
			<KeyValueList
				items={[
					{ term: 'File', detail: loaded.fileName },
					{ term: 'Saved', detail: summary.saved },
					{ term: 'Firmware', detail: summary.firmware, mono: true }
				]}
			/>

			{#if summary.isOtherFirmware}
				<Alert tone="warn" title="Saved from different firmware">
					This keyboard runs firmware 0x{hex16(firmware)}. The settings may not mean the same thing on it.
				</Alert>
			{/if}

			<FieldGroup label="Restore">
				<Checkbox label="Lighting" description={summary.lighting} checked={restoreLighting} onchange={(on) => (restoreLighting = on)} />
				<Checkbox label="Key colours" description={summary.keyColors} checked={restoreKeyColors} onchange={(on) => (restoreKeyColors = on)} />
				<Checkbox
					label="Keys and macros"
					description="Keys of {summary.keys}. Macros: {summary.macros}."
					checked={restoreKeys}
					onchange={(on) => (restoreKeys = on)}
				/>
			</FieldGroup>
			<Hint>Keys and macros go together because keys refer to macros by number. The keyboard stays on the profile it is using.</Hint>
		{/if}

		{#if restoredName}
			<Alert tone="ok" title="Restored">Restored from {restoredName} and read back from the keyboard.</Alert>
		{/if}
	</Card>
</div>

<ConfirmDialog open={confirming} title="Replace settings on the keyboard?" confirmLabel="Restore" onconfirm={restore} oncancel={() => (confirming = false)}>
	<p>
		The chosen parts of {loaded?.fileName ?? 'the file'} replace the keyboard's settings. Save a backup first if you may want the current ones back.
	</p>
</ConfirmDialog>

<style>
	.backup {
		display: grid;
		align-items: start;
		gap: var(--space-6);
	}

	@container content (min-width: 48rem) {
		.backup {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
