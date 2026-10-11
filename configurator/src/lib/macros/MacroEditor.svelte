<script lang="ts">
	/**
	 * @file MacroEditor.svelte
	 * @brief Macros screen: the stored macros with the keys that play them, the space they use, and create, edit and delete.
	 * @note Deleting a macro also rewrites every profile whose keys refer to it or to a later macro, so each key keeps playing the same macro.
	 * @note On wide screens the open macro sits beside the list; on narrow ones it follows below.
	 */
	import { FilePenLine, ListVideo, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { decodeAction, withoutMacro } from '#lib/ck108/keymap.ts';
	import { KEYS } from '#lib/ck108/layout.ts';
	import { MACRO_LIMIT, blobSize, type Macro } from '#lib/ck108/macros.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import List from '#lib/ui/List.svelte';
	import ListItem from '#lib/ui/ListItem.svelte';
	import Meter from '#lib/ui/Meter.svelte';
	import MacroForm from './MacroForm.svelte';

	interface Props {
		macros: readonly Macro[];
		keymaps: readonly Uint8Array[];
		defaults: Uint8Array;
		profile: number;
		space: number;
		hasNames: boolean;
	}

	let { macros, keymaps, defaults, profile, space, hasNames }: Props = $props(); // stored macros, every key map, factory map, active profile, macro space

	const NEW_MACRO: Macro = { name: '', cycles: 1, steps: [] }; // starting point of a new macro

	const connection = getConnection(); // shared connection from the layout
	let editing = $state<{ index: number | null } | null>(null); // macro open in the form, index null for a new one; null when closed
	let confirming = $state<number | null>(null); // macro whose delete awaits confirmation
	let justSaved = $state<string | null>(null); // name of a macro just created, for the assign hint

	const used = $derived(blobSize(macros, true)); // bytes the stored macros take with names
	const keysByMacro = $derived(
		macros.map((_, index) =>
			KEYS.filter((key) => {
				const action = decodeAction(keymaps[profile], key.slot); // what the key does in the active profile
				return action.kind === 'macro' && action.index === index; // plays this macro
			}).map((key) => key.name)
		)
	); // key names per macro, active profile
	const confirmingName = $derived(confirming === null ? '' : (macros[confirming]?.name ?? '')); // name shown in the delete question

	/**
	 * @brief Write the macros with one macro added or replaced, and close the form on success.
	 * @param[in] index Position to replace, or null to append.
	 * @param[in] macro Edited macro.
	 * @return True when the keyboard took it.
	 */
	async function save(index: number | null, macro: Macro): Promise<boolean> {
		const next = index === null ? [...macros, macro] : macros.with(index, macro); // new macro list
		const isWritten = await connection.applyMacros(next); // write and read back
		if (!isWritten) return false; // form stays open with its edits
		justSaved = index === null ? macro.name : null; // offer to assign a new macro
		editing = null; // close the form
		return true; // saved
	}

	/**
	 * @brief Open the form on a macro.
	 * @param[in] index Macro to edit, or null for a new one.
	 */
	function open(index: number | null): void {
		editing = { index }; // show the form
		justSaved = null; // stale hint
	}

	/**
	 * @brief Describe a macro for its list row.
	 * @param[in] macro Stored macro.
	 * @param[in] keys Names of the keys that play it.
	 * @return Step count, plays per press when more than one, and the keys.
	 */
	function summary(macro: Macro, keys: readonly string[]): string {
		const steps = `${macro.steps.length} ${macro.steps.length === 1 ? 'step' : 'steps'}`; // length
		const plays = macro.cycles > 1 ? `, plays ${macro.cycles} times` : ''; // repeats
		return `${steps}${plays} - ${keys.length > 0 ? `on ${keys.join(', ')}` : 'not on a key yet'}`; // row detail
	}

	/**
	 * @brief Delete a macro, renumbering the key references that follow it in every profile.
	 * @param[in] index Macro to delete.
	 */
	function remove(index: number): void {
		const changed = new Map<number, Uint8Array>(); // profile -> adjusted key map
		keymaps.forEach((map, mapProfile) => {
			const adjusted = withoutMacro(map, defaults, index); // references removed and shifted
			if (adjusted.some((byte, at) => byte !== map[at])) changed.set(mapProfile, adjusted); // write only what changed
		});
		confirming = null; // confirmation done
		justSaved = null; // stale hint
		void connection.applyMacros(macros.toSpliced(index, 1), changed); // blob and key maps in one session
	}
</script>

{#if !hasNames}
	<Alert tone="info" title="Macro names were not stored">
		The macros only fitted on the keyboard without their names, so they show as Macro 1, Macro 2 and so on.
	</Alert>
{/if}

{#if justSaved}
	<Alert tone="ok" title={`Saved "${justSaved}"`} ondismiss={() => (justSaved = null)}>
		Pick a key for it under <a href={resolve('/keys')}>Keys</a>: choose the key, then Macro.
	</Alert>
{/if}

<div class="macros">
	<Card title="Stored macros">
		{#snippet actions()}
			<Button size="sm" disabled={editing !== null || macros.length >= MACRO_LIMIT} onclick={() => open(null)}>
				<Plus aria-hidden="true" />
				New macro
			</Button>
		{/snippet}

		<Meter label="Macro space" value={used} max={space} reading="{used} of {space} bytes" />

		{#if macros.length === 0}
			<EmptyState title="No macros yet" icon={ListVideo}>
				A macro plays a sequence of key presses from one key, for example a shortcut or a phrase.
			</EmptyState>
		{:else}
			<List label="Stored macros">
				{#each macros as macro, index}
					<ListItem current={editing?.index === index}>
						<span class="number">M{index + 1}</span>
						<span class="info">
							<span class="name">{macro.name}</span>
							<span class="detail">{summary(macro, keysByMacro[index])}</span>
						</span>
						{#snippet actions()}
							<Button
								variant="ghost"
								size="sm"
								iconOnly
								aria-label="Edit {macro.name}"
								title="Edit"
								disabled={editing !== null}
								onclick={() => open(index)}
							>
								<Pencil aria-hidden="true" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								iconOnly
								aria-label="Delete {macro.name}"
								title="Delete"
								disabled={editing !== null}
								onclick={() => (confirming = index)}
							>
								<Trash2 aria-hidden="true" />
							</Button>
						{/snippet}
					</ListItem>
				{/each}
			</List>
		{/if}
	</Card>

	{#if editing}
		{@const index = editing.index}
		{#key index}
			<MacroForm
				title={index === null ? 'New macro' : `Edit M${index + 1}`}
				macro={index === null ? NEW_MACRO : macros[index]}
				onsave={(macro) => save(index, macro)}
				oncancel={() => (editing = null)}
			/>
		{/key}
	{:else}
		<div class="placeholder">
			<Card>
				<EmptyState title="No macro open" icon={FilePenLine}>Choose Edit on a macro, or create a new one.</EmptyState>
			</Card>
		</div>
	{/if}
</div>

<ConfirmDialog
	open={confirming !== null}
	title={`Delete "${confirmingName}"?`}
	confirmLabel="Delete macro"
	cancelLabel="Keep"
	onconfirm={() => confirming !== null && remove(confirming)}
	oncancel={() => (confirming = null)}
>
	<p>Keys that play it get their factory function back, and the macros after it move up one number on every profile.</p>
</ConfirmDialog>

<style>
	.macros {
		display: grid;
		align-items: start;
		gap: var(--space-6);
	}

	.number {
		flex: none;
		min-width: 2.25rem;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	.info {
		display: grid;
		gap: 1px;
		min-width: 0;
	}

	.name {
		overflow: hidden;
		font-weight: var(--weight-medium);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.placeholder {
		display: none;
	}

	@container content (min-width: 56rem) {
		.macros {
			grid-template-columns: 22rem minmax(0, 1fr);
		}

		.placeholder {
			display: block;
		}
	}
</style>
