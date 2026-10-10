<script lang="ts">
	/**
	 * @file MacroEditor.svelte
	 * @brief Macros screen: the stored macros with the keys that play them, space used, and create, edit and delete.
	 * @note Deleting a macro also rewrites every profile whose keys refer to it or to a later macro, so each key keeps playing the same macro.
	 */
	import { Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { decodeAction, withoutMacro } from '#lib/ck108/keymap.ts';
	import { KEYS } from '#lib/ck108/layout.ts';
	import { MACRO_LIMIT, blobSize, type Macro } from '#lib/ck108/macros.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
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
	<Alert tone="info" title={`Saved "${justSaved}"`}>
		Pick a key for it under <a href={resolve('/keys')}>Keys</a>: choose the key, then Macro.
	</Alert>
{/if}

<Card title="Macros">
	{#snippet actions()}
		<Button
			variant="ghost"
			disabled={editing !== null || macros.length >= MACRO_LIMIT}
			onclick={() => open(null)}
		>
			<Plus size={16} aria-hidden="true" />
			New macro
		</Button>
	{/snippet}

	<Meter label="Macro space" value={used} max={space} reading="{used} of {space} bytes" />

	{#if macros.length === 0}
		<p class="hint">No macros stored. A macro plays a sequence of key presses from one key, for example a shortcut or a phrase.</p>
	{:else}
		<ul>
			{#each macros as macro, index}
				<li>
					<div class="info">
						<span class="name">{index + 1}. {macro.name}</span>
						<span class="detail">
							{macro.steps.length} {macro.steps.length === 1 ? 'step' : 'steps'}{macro.cycles > 1 ? `, plays ${macro.cycles} times` : ''} -
							{keysByMacro[index].length > 0 ? `on ${keysByMacro[index].join(', ')}` : 'not on a key yet'}
						</span>
					</div>
					<div class="row-actions">
						{#if confirming === index}
							<span class="detail">Delete it?</span>
							<Button variant="primary" onclick={() => remove(index)}>Delete</Button>
							<Button onclick={() => (confirming = null)}>Keep</Button>
						{:else}
							<Button variant="ghost" disabled={editing !== null} onclick={() => open(index)}>
								<Pencil size={16} aria-hidden="true" />
								Edit
							</Button>
							<Button variant="ghost" disabled={editing !== null} onclick={() => (confirming = index)}>
								<Trash2 size={16} aria-hidden="true" />
								Delete
							</Button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Card>

{#if editing}
	{@const index = editing.index}
	{#key index}
		<MacroForm
			title={index === null ? 'New macro' : `Edit macro ${index + 1}`}
			macro={index === null ? NEW_MACRO : macros[index]}
			onsave={(macro) => save(index, macro)}
			oncancel={() => (editing = null)}
		/>
	{/key}
{/if}

<style>
	ul {
		display: grid;
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}

	.info {
		display: grid;
		gap: 2px;
	}

	.name {
		font-weight: 600;
	}

	.detail {
		font-size: 13px;
		color: var(--text-muted);
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.hint {
		margin: 16px 0 0;
		font-size: 13px;
		color: var(--text-muted);
	}

	a {
		color: var(--accent);
	}
</style>
