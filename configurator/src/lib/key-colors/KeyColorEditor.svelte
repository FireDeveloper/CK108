<script lang="ts">
	/**
	 * @file KeyColorEditor.svelte
	 * @brief Per-key colour editor: select keys on a drawing of the keyboard and paint them; every change is written to the keyboard at once.
	 * @note The keyboard shows these colours only in the custom effect; the editor offers to switch to it.
	 */
	import { PaintBucket, Paintbrush } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { KEYS } from '#lib/ck108/layout.ts';
	import { LightingOffset, MODE_CUSTOM, byteField, formatColor, parseColor } from '#lib/ck108/protocol.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import ColorField from '#lib/ui/ColorField.svelte';
	import KeyMap from '#lib/ui/KeyMap.svelte';
	import SwatchPicker from '#lib/ui/SwatchPicker.svelte';

	interface Props {
		colors: Uint8Array;
		mode: number;
	}

	let { colors, mode }: Props = $props(); // keyboard's per-key buffer, current effect

	const PRESETS = [
		{ value: '#ff0000', name: 'Red' },
		{ value: '#ff7a00', name: 'Orange' },
		{ value: '#ffd400', name: 'Yellow' },
		{ value: '#00e04a', name: 'Green' },
		{ value: '#00d5ff', name: 'Cyan' },
		{ value: '#0050ff', name: 'Blue' },
		{ value: '#8a2bff', name: 'Purple' },
		{ value: '#ff2bd6', name: 'Pink' },
		{ value: '#ffffff', name: 'White' },
		{ value: '#000000', name: 'Off' }
	]; // quick colours
	const EVERY_KEY = KEYS.map((key) => key.led); // LED of every drawn key

	const connection = getConnection(); // shared connection from the layout
	const selected = new SvelteSet<number>(); // LEDs picked on the map
	let paint = $state(PRESETS[0].value); // colour the paint actions use
	const mapKeys = $derived(KEYS.map((key) => ({ ...key, id: key.led, color: formatColor(colors, key.led * 3) }))); // keys filled with their stored colour

	/**
	 * @brief Add a key to the selection or remove it.
	 * @param[in] led LED index of the key.
	 * @param[in] on True to select, false to deselect.
	 */
	function select(led: number, on: boolean): void {
		if (on) selected.add(led); // pick
		else selected.delete(led); // unpick
	}

	/** @brief Select every drawn key. */
	function selectAll(): void {
		for (const led of EVERY_KEY) selected.add(led); // pick each key
	}

	/**
	 * @brief Give keys one colour and write the whole buffer.
	 * @param[in] leds LED indexes to recolour.
	 * @param[in] color "#rrggbb".
	 */
	function paintLeds(leds: Iterable<number>, color: string): void {
		const rgb = parseColor(color); // R G B bytes
		const next = colors.slice(); // edit a copy; the shown buffer stays untouched until applied
		for (const led of leds) next.set(rgb, led * 3); // recolour each key
		void connection.applyKeyColors(next); // show, write, read back
	}

	/** @brief Switch the keyboard to the custom effect so it shows these colours. */
	function showOnKeyboard(): void {
		void connection.applyLighting([byteField(LightingOffset.mode, MODE_CUSTOM)]); // custom backlit mode
	}
</script>

{#if mode !== MODE_CUSTOM}
	<Alert tone="info" title="The keyboard shows these colours only in Custom backlit mode">
		Edits are stored on the keyboard either way.
		{#snippet actions()}
			<Button variant="primary" onclick={showOnKeyboard}>Show on keyboard</Button>
		{/snippet}
	</Alert>
{/if}

<Card title="Key colours">
	{#snippet actions()}
		<Button variant="ghost" onclick={selectAll}>Select all</Button>
		<Button variant="ghost" onclick={() => selected.clear()} disabled={selected.size === 0}>Clear selection</Button>
	{/snippet}

	<div class="toolbar">
		<div class="colour">
			<SwatchPicker label="Preset colours" colors={PRESETS} value={paint} onchange={(color) => (paint = color)} />
			<ColorField label="Any colour" value={paint} onchange={(color) => (paint = color)} />
		</div>
		<div class="actions">
			<Button variant="primary" disabled={selected.size === 0} onclick={() => paintLeds(selected, paint)}>
				<Paintbrush size={16} aria-hidden="true" />
				Paint selected ({selected.size})
			</Button>
			<Button onclick={() => paintLeds(EVERY_KEY, paint)}>
				<PaintBucket size={16} aria-hidden="true" />
				Paint every key
			</Button>
		</div>
	</div>

	<KeyMap label="Keyboard keys" keys={mapKeys} {selected} onselect={select} />
	<p class="hint">Click a key or drag across keys to select them; Enter or Space toggles the focused key.</p>
</Card>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}

	.colour {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 20px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.hint {
		margin: 12px 0 0;
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
