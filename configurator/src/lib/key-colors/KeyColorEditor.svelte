<script lang="ts">
	/**
	 * @file KeyColorEditor.svelte
	 * @brief Per-key colour editor: paint keys picked on a drawing of the keyboard, or every key at once with a gradient of your own or a ready-made pattern;
	 *        every change is written to the keyboard at once.
	 * @note The keyboard shows these colours only in the custom effect; the editor offers to switch to it.
	 * @note Undo takes back the changes made since the editor opened, newest first, on the active profile.
	 */
	import { ArrowDown, ArrowDownRight, ArrowLeftRight, ArrowRight, Expand, PaintBucket, Paintbrush, Undo2, type LucideIcon } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { KEYS } from '#lib/ck108/layout.ts';
	import { LightingOffset, MODE_CUSTOM, byteField, formatColor, parseColor } from '#lib/ck108/protocol.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import ColorField from '#lib/ui/ColorField.svelte';
	import KeyMap from '#lib/ui/KeyMap.svelte';
	import KeyMapThumbnail from '#lib/ui/KeyMapThumbnail.svelte';
	import SegmentedControl from '#lib/ui/SegmentedControl.svelte';
	import SwatchPicker from '#lib/ui/SwatchPicker.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import ThumbnailButton from '#lib/ui/ThumbnailButton.svelte';
	import { PATTERNS, PATTERN_GROUPS, gradientColors, paintKeys, patternColors, showsColors, type GradientDirection } from './patterns.ts';

	interface Props {
		colors: Uint8Array;
		mode: number;
		profile: number;
	}

	/** @brief A colour buffer Undo can return a profile to. */
	interface Change {
		profile: number;
		colors: Uint8Array;
	}

	/** @brief The custom gradient's settings. */
	interface CustomGradient {
		start: string;
		middle: string;
		end: string;
		hasMiddle: boolean;
		direction: GradientDirection;
	}

	let { colors, mode, profile }: Props = $props(); // keyboard's per-key buffer, current effect, profile both belong to

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
	const GRADIENT_DIRECTIONS: readonly { value: GradientDirection; label: string; icon: LucideIcon }[] = [
		{ value: 'across', label: 'Across', icon: ArrowRight },
		{ value: 'down', label: 'Down', icon: ArrowDown },
		{ value: 'diagonal', label: 'Diagonal', icon: ArrowDownRight },
		{ value: 'centre', label: 'Centre out', icon: Expand }
	]; // ways a custom gradient can run
	const EVERY_KEY = KEYS.map((key) => key.led); // LED of every drawn key
	const UNDO_DEPTH = 50; // changes Undo can take back
	const TILES = PATTERNS.map((pattern) => {
		const keyColors = patternColors(pattern); // one colour per drawn key
		return { pattern, keyColors, picture: thumbnailKeys(keyColors) }; // tile data
	}); // gallery tiles, in PATTERNS order
	const SECTIONS = PATTERN_GROUPS.map((group) => ({ group, tiles: TILES.filter((tile) => tile.pattern.group === group) })); // tiles under their headings

	const connection = getConnection(); // shared connection from the layout
	const selected = new SvelteSet<number>(); // LEDs picked on the map
	let paint = $state(PRESETS[0].value); // colour the paint actions use
	const custom = $state<CustomGradient>({ start: '#ff2bd6', middle: '#8a2bff', end: '#00d5ff', hasMiddle: false, direction: 'across' }); // custom gradient settings
	let history = $state.raw<readonly Change[]>([]); // buffers Undo returns to, oldest first
	const mapKeys = $derived(KEYS.map((key) => ({ ...key, id: key.led, color: formatColor(colors, key.led * 3) }))); // keys filled with their stored colour
	const customStops = $derived(custom.hasMiddle ? [custom.start, custom.middle, custom.end] : [custom.start, custom.end]); // colours the custom gradient blends
	const customColors = $derived(gradientColors(customStops, custom.direction)); // custom gradient's colour per key
	const shown = $derived(TILES.find((tile) => showsColors(colors, tile.keyColors))?.pattern.id); // pattern the keys show now, if any
	const undoable = $derived(history.findLast((change) => change.profile === profile)); // newest change on the active profile

	/**
	 * @brief Thumbnail keys showing given key colours.
	 * @param[in] keyColors One "#rrggbb" per entry of KEYS.
	 * @return Keys for KeyMapThumbnail, in KEYS order.
	 */
	function thumbnailKeys(keyColors: readonly string[]) {
		return KEYS.map((key, index) => ({ id: key.led, x: key.x, y: key.y, w: key.w, h: key.h, color: keyColors[index] })); // key rectangles in those colours
	}

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
		write(next); // remember, show, write, read back
	}

	/**
	 * @brief Paint every drawn key with its own colour and write the whole buffer.
	 * @param[in] keyColors One "#rrggbb" per entry of KEYS, from a pattern or the custom gradient.
	 */
	function applyPattern(keyColors: readonly string[]): void {
		write(paintKeys(keyColors, colors)); // remember, show, write, read back
	}

	/** @brief Swap the custom gradient's start and end colours, so it runs the other way. */
	function swapEnds(): void {
		[custom.start, custom.end] = [custom.end, custom.start]; // exchange the ends
	}

	/**
	 * @brief Write a new buffer for the active profile, remembering the one it replaces so Undo can return to it.
	 * @param[in] next KEY_COLORS_SIZE bytes, R G B per LED.
	 */
	function write(next: Uint8Array): void {
		if (next.some((byte, index) => byte !== colors[index])) history = [...history, { profile, colors }].slice(-UNDO_DEPTH); // remember a buffer that changes
		void connection.applyKeyColors(next); // show, write, read back
	}

	/** @brief Write back the buffer from before the newest change on the active profile. */
	function undo(): void {
		const change = undoable; // change to take back
		if (!change) return; // nothing to undo
		history = history.filter((entry) => entry !== change); // drop it, so a second Undo reaches the change before
		void connection.applyKeyColors(change.colors); // show, write, read back
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
			<Button size="sm" onclick={showOnKeyboard}>Show on keyboard</Button>
		{/snippet}
	</Alert>
{/if}

<Card title="Paint keys" description="Click a key or drag across keys to select them; Enter or Space toggles the focused key.">
	{#snippet actions()}
		<Button variant="ghost" size="sm" onclick={selectAll}>Select all</Button>
		<Button variant="ghost" size="sm" disabled={selected.size === 0} onclick={() => selected.clear()}>Clear selection</Button>
	{/snippet}

	<div class="palette">
		<SwatchPicker label="Preset colours" colors={PRESETS} value={paint} onchange={(color) => (paint = color)} />
		<ColorField label="Any colour" value={paint} onchange={(color) => (paint = color)} />
	</div>

	<KeyMap label="Keyboard keys" keys={mapKeys} {selected} onselect={select} />

	{#snippet footer()}
		<Button onclick={() => paintLeds(EVERY_KEY, paint)}>
			<PaintBucket aria-hidden="true" />
			Paint every key
		</Button>
		<Button variant="primary" disabled={selected.size === 0} onclick={() => paintLeds(selected, paint)}>
			<Paintbrush aria-hidden="true" />
			Paint selected ({selected.size})
		</Button>
	{/snippet}
</Card>

<Card title="Patterns" description="Blend a gradient of your own or pick a ready-made pattern to paint every key at once. Undo takes back the last colour change on this profile.">
	{#snippet actions()}
		<Button variant="ghost" size="sm" disabled={!undoable} onclick={undo}>
			<Undo2 aria-hidden="true" />
			Undo
		</Button>
	{/snippet}

	<div class="gallery">
		<div class="group">
			<h3>Custom gradient</h3>
			<div class="custom">
				<div class="preview">
					<KeyMapThumbnail keys={thumbnailKeys(customColors)} />
				</div>
				<div class="settings">
					<div class="stops">
						<ColorField label="Start" value={custom.start} oninput={(color) => (custom.start = color)} />
						{#if custom.hasMiddle}
							<ColorField label="Middle" value={custom.middle} oninput={(color) => (custom.middle = color)} />
						{/if}
						<ColorField label="End" value={custom.end} oninput={(color) => (custom.end = color)} />
						<Button variant="ghost" iconOnly aria-label="Swap start and end" title="Swap start and end" onclick={swapEnds}>
							<ArrowLeftRight aria-hidden="true" />
						</Button>
					</div>
					<Switch label="Middle colour" checked={custom.hasMiddle} onchange={(on) => (custom.hasMiddle = on)} />
					<SegmentedControl label="Direction" options={GRADIENT_DIRECTIONS} value={custom.direction} onchange={(direction) => (custom.direction = direction)} />
					<Button variant="primary" onclick={() => applyPattern(customColors)}>
						<PaintBucket aria-hidden="true" />
						Paint gradient
					</Button>
				</div>
			</div>
		</div>

		{#each SECTIONS as section (section.group)}
			<div class="group">
				<h3>{section.group}</h3>
				<ul class="tiles">
					{#each section.tiles as tile (tile.pattern.id)}
						<li>
							<ThumbnailButton label={tile.pattern.name} current={tile.pattern.id === shown} onclick={() => applyPattern(tile.keyColors)}>
								<KeyMapThumbnail keys={tile.picture} />
							</ThumbnailButton>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</Card>

<style>
	.palette {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-4) var(--space-8);
	}

	.gallery {
		display: grid;
		gap: var(--space-6);
	}

	.group {
		display: grid;
		gap: var(--space-2);
	}

	h3 {
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.custom {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-4) var(--space-6);
	}

	.preview {
		flex: 1 1 18rem;
		max-width: 28rem;
	}

	.settings {
		display: grid;
		flex: 1 1 20rem;
		justify-items: start;
		gap: var(--space-4);
	}

	.stops {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
