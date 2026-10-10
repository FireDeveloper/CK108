<script lang="ts">
	/**
	 * @file LightingPanel.svelte
	 * @brief Lighting editor: the effect picker and the controls the chosen effect uses; every change is written to the keyboard at once.
	 * @note Renders two cards with no wrapper, so they take part in the parent grid; the effect card spans the full width.
	 */
	import { resolve } from '$app/paths';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { LEVEL_MAX, LightingOffset, MODES, byteField, colorFields, modeControls, type Lighting } from '#lib/ck108/protocol.ts';
	import Card from '#lib/ui/Card.svelte';
	import ColorField from '#lib/ui/ColorField.svelte';
	import SegmentedControl from '#lib/ui/SegmentedControl.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import TileSelect from '#lib/ui/TileSelect.svelte';

	interface Props {
		lighting: Lighting;
		modes: number[];
	}

	let { lighting, modes }: Props = $props(); // keyboard's lighting state, effects its firmware lists

	const DIRECTIONS = [
		{ value: 0, label: 'Forward' },
		{ value: 1, label: 'Reverse' }
	]; // direction byte choices

	const connection = getConnection(); // shared connection from the layout
	const controls = $derived(modeControls(lighting.mode)); // controls the current effect uses
	const effects = $derived(modes.map((mode) => ({ value: mode, label: MODES[mode] ?? `Mode ${mode}`, badge: String(mode) }))); // picker tiles
	const hasSettings = $derived(controls.speed || controls.direction || controls.color || controls.rainbow); // anything besides brightness

	/**
	 * @brief Write one single-byte lighting field.
	 * @param[in] offset A LightingOffset value.
	 * @param[in] value 0..255.
	 */
	function writeByte(offset: number, value: number): void {
		void connection.applyLighting([byteField(offset, value)]); // write and read back
	}
</script>

<Card title="Settings">
	<div class="controls">
		<Slider
			label="Brightness"
			value={lighting.brightness}
			max={LEVEL_MAX}
			minLabel="Low"
			maxLabel="High"
			onchange={(level) => writeByte(LightingOffset.brightness, level)}
		/>
		{#if controls.speed}
			<!--? The keyboard stores 0 as fastest; the slider shows faster to the right. -->
			<Slider
				label="Speed"
				value={LEVEL_MAX - lighting.speed}
				max={LEVEL_MAX}
				minLabel="Slow"
				maxLabel="Fast"
				onchange={(level) => writeByte(LightingOffset.speed, LEVEL_MAX - level)}
			/>
		{/if}
		{#if controls.direction}
			<SegmentedControl
				label="Direction"
				options={DIRECTIONS}
				value={lighting.direction}
				onchange={(direction) => writeByte(LightingOffset.direction, direction)}
			/>
		{/if}
		{#if controls.color}
			<ColorField
				label="Colour"
				value={lighting.color}
				disabled={controls.rainbow && lighting.colorful}
				onchange={(color) => void connection.applyLighting(colorFields(color))}
			/>
		{/if}
		{#if controls.rainbow}
			<Switch label="Rainbow instead of one colour" checked={lighting.colorful} onchange={(on) => writeByte(LightingOffset.colorful, on ? 1 : 0)} />
		{/if}
		{#if !hasSettings}
			<p class="hint">This effect has no settings besides brightness.</p>
		{/if}
	</div>
</Card>

<div class="wide">
	<Card title="Effect">
		<TileSelect label="Effect" options={effects} value={lighting.mode} onchange={(mode) => writeByte(LightingOffset.mode, mode)} />
		<p class="hint">Custom backlit mode shows the colours set under <a href={resolve('/colors')}>Key colours</a>.</p>
	</Card>
</div>

<style>
	.controls {
		display: grid;
		gap: 18px;
	}

	.wide {
		grid-column: 1 / -1;
	}

	.hint {
		margin: 12px 0 0;
		font-size: 13px;
		color: var(--text-muted);
	}

	.controls .hint {
		margin: 0;
	}

	.hint a {
		color: var(--accent);
	}
</style>
