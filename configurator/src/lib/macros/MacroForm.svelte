<script lang="ts">
	/**
	 * @file MacroForm.svelte
	 * @brief Editor for one macro: name, plays per key press, and its steps, filled by recording keys, adding a key combination, or by hand.
	 * @note Nothing is written until Save; the parent writes the macro through onsave and closes the form when it reports success.
	 */
	import { ArrowDown, ArrowUp, Circle, Plus, Square, Trash2 } from '@lucide/svelte';
	import { CYCLES_MAX, DELAY_MAX_MS, NAME_LIMIT, targetName, type Macro, type MacroStep, type StepTarget } from '#lib/ck108/macros.ts';
	import { KEYBOARD_USAGES, MEDIA_USAGES, MODIFIERS, MODIFIER_USAGE_BASE, SYSTEM_USAGES, usageForCode } from '#lib/ck108/usages.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import SegmentedControl from '#lib/ui/SegmentedControl.svelte';
	import SelectMenu from '#lib/ui/SelectMenu.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	interface Props {
		title: string;
		macro: Macro;
		onsave: (macro: Macro) => Promise<boolean>;
		oncancel: () => void;
	}

	let { title, macro, onsave, oncancel }: Props = $props(); // heading, macro to start from, write callback, close callback

	const DEFAULT_DELAY_MS = 20; // pause after each step when pauses are not recorded
	const NAME_INPUT_LIMIT = 40; // longest name the form accepts, well under NAME_LIMIT
	const COMBO_MODIFIERS = MODIFIERS.slice(0, 4); // left Ctrl, Shift, Alt, Win
	const DIRECTIONS = [
		{ value: 'press', label: 'Press' },
		{ value: 'release', label: 'Release' }
	]; // step direction choices
	const TARGETS = [
		...MODIFIERS.map((modifier, index) => ({ value: `key:${MODIFIER_USAGE_BASE + index}`, label: modifier.name, group: 'Modifiers' })),
		...KEYBOARD_USAGES.map(({ usage, name, group }) => ({ value: `key:${usage}`, label: name, group })),
		...MEDIA_USAGES.map(({ usage, name }) => ({ value: `media:${usage}`, label: name, group: 'Media' })),
		...SYSTEM_USAGES.map(({ usage, name }) => ({ value: `system:${usage}`, label: name, group: 'System' }))
	]; // step target picker entries, value "page:usage"
	const KEY_OPTIONS = KEYBOARD_USAGES.map(({ usage, name, group }) => ({ value: usage, label: name, group })); // combination key picker entries

	let name = $derived(macro.name); // edited name, reset when the macro prop changes
	let cycles = $derived(String(macro.cycles)); // edited plays per key press, as typed
	let steps = $derived<MacroStep[]>(macro.steps.map((step) => ({ ...step }))); // edited steps, replaced on every change
	let current = $state<number | null>(null); // step open in the step editor
	let recording = $state(false); // recording keys from this page
	let recordPauses = $state(true); // keep the real gaps between recorded keys
	let skipped = $state<string | null>(null); // last key code recording could not use
	let comboMask = $state(0); // combination modifiers, left-hand bits
	let comboKey = $state<number | null>(null); // combination key usage
	let saving = $state(false); // write in flight
	let lastEventAt: number | null = null; // time of the last key recorded in this recording, ms; null before the first

	const plays = $derived(Number(cycles)); // parsed plays per key press
	const isPlaysValid = $derived(Number.isInteger(plays) && plays >= 1 && plays <= CYCLES_MAX); // storable count
	const held = $derived(heldAtEnd(steps)); // targets still pressed when the macro ends
	const canSave = $derived(name.trim() !== '' && isPlaysValid && steps.length > 0 && !recording && !saving); // complete and idle
	const step = $derived(current === null ? null : (steps[current] ?? null)); // step being edited

	/**
	 * @brief Add steps after the last one, giving the old last step a pause first.
	 * @param[in] added Steps to append.
	 * @param[in] pause Pause after the old last step, ms.
	 */
	function append(added: MacroStep[], pause: number): void {
		const last = steps.at(-1); // old last step
		const head = last && last.delay === 0 ? steps.with(-1, { ...last, delay: pause }) : steps; // pause before the new steps
		steps = [...head, ...added]; // new step list
	}

	/**
	 * @brief Record one key event from this page while recording is on.
	 * @param[in] event keydown or keyup on the window.
	 * @param[in] press True for keydown.
	 */
	function record(event: KeyboardEvent, press: boolean): void {
		//- Only while recording, and never auto-repeat
		if (!recording) return; // not recording
		event.preventDefault(); // the page does not act on recorded keys
		if (event.repeat) return; // held key repeating

		//- Translate and append
		const target = usageForCode(event.code); // usage the keyboard would send
		if (!target) {
			skipped = event.code || event.key; // tell the user which key was dropped
			return; // nothing the CK108 can send
		}
		const now = event.timeStamp; // event time, ms
		const pause = recordPauses && lastEventAt !== null ? Math.round(now - lastEventAt) : DEFAULT_DELAY_MS; // gap since the previous key
		lastEventAt = now; // gap reference for the next key
		append([{ press, target, delay: 0 }], Math.min(pause, DELAY_MAX_MS)); // new last step
	}

	/** @brief Start or stop recording keys. */
	function toggleRecording(): void {
		recording = !recording; // flip
		lastEventAt = null; // gaps restart with this recording
		skipped = null; // fresh notice
		current = null; // close the step editor while keys arrive
	}

	/** @brief Append the chosen key combination: modifiers down, key down, key up, modifiers up. */
	function addCombination(): void {
		if (comboKey === null) return; // no key chosen
		const mods = COMBO_MODIFIERS.filter((modifier) => comboMask & modifier.bit).map((modifier) => ({ page: 'key', usage: MODIFIER_USAGE_BASE + Math.log2(modifier.bit) }) as const); // chosen modifiers as usages
		const key = { page: 'key', usage: comboKey } as const; // chosen key
		const down = [...mods, key].map((target) => ({ press: true, target, delay: DEFAULT_DELAY_MS })); // press in order
		const up = [key, ...mods.toReversed()].map((target) => ({ press: false, target, delay: DEFAULT_DELAY_MS })); // release in reverse
		const added = [...down, ...up]; // whole combination
		added[added.length - 1].delay = 0; // nothing follows yet
		append(added, DEFAULT_DELAY_MS); // after the existing steps
	}

	/**
	 * @brief Replace one step.
	 * @param[in] index Step position.
	 * @param[in] change Fields to change.
	 */
	function updateStep(index: number, change: Partial<MacroStep>): void {
		steps = steps.with(index, { ...steps[index], ...change }); // new step list
	}

	/**
	 * @brief Move a step up or down one place.
	 * @param[in] index Step position.
	 * @param[in] offset -1 for up, 1 for down.
	 */
	function moveStep(index: number, offset: number): void {
		const other = index + offset; // position to swap with
		if (other < 0 || other >= steps.length) return; // already at the end
		steps = steps.with(index, steps[other]).with(other, steps[index]); // swap
		current = other; // editor follows the step
	}

	/**
	 * @brief Remove a step.
	 * @param[in] index Step position.
	 */
	function removeStep(index: number): void {
		steps = steps.toSpliced(index, 1); // drop it
		current = null; // nothing open
	}

	/** @brief Remove every step. */
	function clearSteps(): void {
		steps = []; // empty list
		current = null; // nothing open
	}

	/** @brief Add a key press after the last step and open it. */
	function addStep(): void {
		append([{ press: true, target: { page: 'key', usage: KEYBOARD_USAGES[0].usage }, delay: 0 }], DEFAULT_DELAY_MS); // press of the first key in the table
		current = steps.length - 1; // open the new step
	}

	/**
	 * @brief Parse a step target picker value.
	 * @param[in] value "page:usage" from TARGETS.
	 * @return The target.
	 */
	function parseTarget(value: string): StepTarget {
		const [page, usage] = value.split(':'); // page and usage
		return { page: page as 'key' | 'media' | 'system', usage: Number(usage) }; // picker values only name these pages
	}

	/**
	 * @brief Format a step target as a picker value.
	 * @param[in] target Step target.
	 * @return "page:usage", or null for an undecoded step.
	 */
	function targetValue(target: StepTarget): string | null {
		return target.page === 'raw' ? null : `${target.page}:${target.usage}`; // picker value
	}

	/**
	 * @brief Find what a step list leaves pressed at its end.
	 * @param[in] list Steps in order.
	 * @return Names of the targets pressed and never released afterwards.
	 */
	function heldAtEnd(list: readonly MacroStep[]): string[] {
		const down = new Map<string, string>(); // picker value -> name, for pressed targets
		for (const { press, target } of list) {
			const id = targetValue(target); // identity of the target
			if (id === null) continue; // undecoded step
			if (press) down.set(id, targetName(target)); // now held
			else down.delete(id); // released
		}
		return [...down.values()]; // still held
	}

	/** @brief Hand the edited macro to the parent for writing. */
	async function save(): Promise<void> {
		saving = true; // block a second save
		try {
			await onsave({ name: name.trim(), cycles: plays, steps }); // parent writes and closes on success
		} finally {
			saving = false; // ready again
		}
	}
</script>

<svelte:window onkeydown={(event) => record(event, true)} onkeyup={(event) => record(event, false)} />

<Card {title}>
	<div class="fields">
		<TextField label="Name" value={name} maxlength={Math.min(NAME_INPUT_LIMIT, NAME_LIMIT)} oninput={(value) => (name = value)} />
		<TextField label="Plays per key press" type="number" min={1} max={CYCLES_MAX} value={cycles} suffix="times" oninput={(value) => (cycles = value)} />
	</div>
	{#if !isPlaysValid}
		<p class="error">Plays per key press must be a whole number from 1 to {CYCLES_MAX}.</p>
	{/if}

	<section>
		<h3>Record keys</h3>
		<div class="row">
			<Button variant={recording ? 'primary' : 'secondary'} onclick={toggleRecording}>
				{#if recording}
					<Square size={16} aria-hidden="true" />
					Stop recording
				{:else}
					<Circle size={16} aria-hidden="true" />
					Start recording
				{/if}
			</Button>
			<Checkbox label="Keep the pauses between keys" checked={recordPauses} disabled={recording} onchange={(on) => (recordPauses = on)} />
		</div>
		<p class="hint">
			{#if recording}
				Recording: every key you press and release is added below. Click Stop recording when done.
			{:else}
				Keys are added after the existing steps. Without the pauses, steps are {DEFAULT_DELAY_MS} ms apart. Shortcuts the browser keeps for
				itself, such as Ctrl+W, cannot be recorded; add them as a combination instead.
			{/if}
		</p>
		{#if skipped}
			<p class="hint">{skipped} cannot be sent by the keyboard and was left out.</p>
		{/if}
	</section>

	<section>
		<h3>Add a key combination</h3>
		<div class="combo">
			{#each COMBO_MODIFIERS as modifier (modifier.bit)}
				<Checkbox
					label={modifier.short}
					checked={(comboMask & modifier.bit) !== 0}
					onchange={(on) => (comboMask = on ? comboMask | modifier.bit : comboMask & ~modifier.bit)}
				/>
			{/each}
			<div class="combo-key">
				<SelectMenu label="Key" hideLabel options={KEY_OPTIONS} value={comboKey} placeholder="Key..." onchange={(value) => (comboKey = value)} />
			</div>
			<Button disabled={comboKey === null || recording} onclick={addCombination}>
				<Plus size={16} aria-hidden="true" />
				Add
			</Button>
		</div>
	</section>

	<section>
		<h3>Steps</h3>
		{#if steps.length === 0}
			<p class="hint">No steps yet. Record keys, add a combination, or add steps one by one.</p>
		{:else}
			<ol class="steps">
				{#each steps as item, index}
					<li class={{ open: current === index }}>
						<Button variant="ghost" onclick={() => (current = current === index ? null : index)} aria-expanded={current === index}>
							<span class="number">{index + 1}</span>
							<span class={['direction', { press: item.press }]}>{item.press ? 'Press' : 'Release'}</span>
							<span class="target">{targetName(item.target)}</span>
							{#if item.delay > 0}<span class="pause">then {item.delay} ms</span>{/if}
						</Button>
					</li>
				{/each}
			</ol>
		{/if}

		{#if step && current !== null}
			{@const index = current}
			<div class="step-editor">
				<SegmentedControl
					label="Step {index + 1}"
					options={DIRECTIONS}
					value={step.press ? 'press' : 'release'}
					onchange={(value) => updateStep(index, { press: value === 'press' })}
				/>
				{#if step.target.page === 'raw'}
					<p class="hint">{targetName(step.target)}: kept as stored.</p>
				{:else}
					<SelectMenu label="Key" options={TARGETS} value={targetValue(step.target)} onchange={(value) => updateStep(index, { target: parseTarget(value) })} />
				{/if}
				<TextField
					label="Pause after this step"
					type="number"
					min={0}
					max={DELAY_MAX_MS}
					step={10}
					suffix="ms"
					value={String(step.delay)}
					oninput={(value) => updateStep(index, { delay: Math.max(0, Number(value) || 0) })}
				/>
				<div class="row">
					<Button variant="ghost" disabled={index === 0} onclick={() => moveStep(index, -1)} aria-label="Move step up" title="Move up">
						<ArrowUp size={16} aria-hidden="true" />
					</Button>
					<Button variant="ghost" disabled={index === steps.length - 1} onclick={() => moveStep(index, 1)} aria-label="Move step down" title="Move down">
						<ArrowDown size={16} aria-hidden="true" />
					</Button>
					<Button variant="ghost" onclick={() => removeStep(index)}>
						<Trash2 size={16} aria-hidden="true" />
						Remove step
					</Button>
				</div>
				<p class="hint">Pauses are stored in steps of 10 ms, up to {DELAY_MAX_MS} ms.</p>
			</div>
		{/if}

		<div class="row">
			<Button variant="ghost" disabled={recording} onclick={addStep}>
				<Plus size={16} aria-hidden="true" />
				Add step
			</Button>
			<Button variant="ghost" disabled={recording || steps.length === 0} onclick={clearSteps}>
				<Trash2 size={16} aria-hidden="true" />
				Clear steps
			</Button>
		</div>
	</section>

	{#if held.length > 0}
		<Alert tone="warn" title="Still held when the macro ends: {held.join(', ')}">
			Add a release step for each, or the computer may treat them as held down.
		</Alert>
	{/if}

	<div class="actions">
		<Button variant="primary" disabled={!canSave} onclick={save}>{saving ? 'Saving...' : 'Save to keyboard'}</Button>
		<Button disabled={saving} onclick={oncancel}>Cancel</Button>
	</div>
</Card>

<style>
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
		max-width: 620px;
	}

	section {
		margin-top: 22px;
	}

	h3 {
		margin: 0 0 10px;
		font-size: 14px;
	}

	.row,
	.combo {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}

	.combo-key {
		width: 200px;
	}

	.steps {
		display: grid;
		gap: 2px;
		max-height: 360px;
		margin: 0 0 12px;
		padding: 0;
		overflow-y: auto;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-small);
	}

	.steps li :global(.button) {
		width: 100%;
		justify-content: flex-start;
		border-radius: 0;
		font-weight: 400;
		color: var(--text);
	}

	.steps li.open :global(.button) {
		background: var(--accent-soft);
	}

	.number {
		width: 2.5em;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	.direction {
		width: 5em;
		color: var(--text-muted);
	}

	.direction.press {
		color: var(--accent);
	}

	.target {
		font-weight: 600;
	}

	.pause {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 13px;
	}

	.step-editor {
		display: grid;
		gap: 14px;
		max-width: 520px;
		margin-bottom: 12px;
		padding: 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-small);
		background: var(--surface-raised);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 22px;
	}

	.hint,
	.error {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--text-muted);
	}

	.error {
		color: var(--danger);
	}
</style>
