<script lang="ts">
	/**
	 * @file LightingPanel.svelte
	 * @brief Lighting editor: the effect gallery and the settings the chosen effect uses; every change is written to the keyboard at once.
	 * @note On wide screens the settings sit in a column beside the gallery and stay in view while it scrolls.
	 */
	import { resolve } from '$app/paths';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import {
		DIRECTIONS,
		LEVEL_MAX,
		LightingOffset,
		MODES,
		MODE_CUSTOM,
		PRESETS,
		byteField,
		colorFields,
		modeControls,
		type Lighting
	} from '#lib/ck108/protocol.ts';
	import Card from '#lib/ui/Card.svelte';
	import ColorField from '#lib/ui/ColorField.svelte';
	import Hint from '#lib/ui/Hint.svelte';
	import SegmentedControl from '#lib/ui/SegmentedControl.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import SwatchPicker from '#lib/ui/SwatchPicker.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import TileSelect from '#lib/ui/TileSelect.svelte';

	interface Props {
		lighting: Lighting;
		modes: number[];
	}

	let { lighting, modes }: Props = $props(); // keyboard's lighting state, effects its firmware lists

	const PRESET_SWATCHES = PRESETS.map(({ name, color }) => ({ value: color, name })); // preset colour chips

	const connection = getConnection(); // shared connection from the layout
	const controls = $derived(modeControls(lighting.mode)); // controls the current effect uses
	const effects = $derived(
		modes.map((mode) => ({ value: mode, label: effectName(mode), description: mode === MODE_CUSTOM ? 'Shows your key colours' : undefined }))
	); // gallery tiles
	const hasSettings = $derived(controls.speed || controls.direction || controls.color || controls.rainbow || controls.preset); // anything besides brightness
	const directions = $derived((DIRECTIONS[lighting.mode] ?? []).map(({ value, name }) => ({ value, label: name }))); // direction choices the current effect offers

	/**
	 * @brief Name an effect.
	 * @param[in] mode Mode byte.
	 * @return Its MODES name, or "Mode N" for a byte MODES does not name.
	 */
	function effectName(mode: number): string {
		return MODES[mode] ?? `Mode ${mode}`; // known name or a generic one
	}

	/**
	 * @brief Write one single-byte lighting field.
	 * @param[in] offset A LightingOffset value.
	 * @param[in] value 0..255.
	 */
	function writeByte(offset: number, value: number): void {
		void connection.applyLighting([byteField(offset, value)]); // write and read back
	}
</script>

<div class="lighting">
	<Card title="Effect" description="The animation the backlight plays.">
		<TileSelect label="Effect" options={effects} value={lighting.mode} onchange={(mode) => writeByte(LightingOffset.mode, mode)} />
	</Card>

	<div class="settings">
		<Card title="Settings" description="For {effectName(lighting.mode)}">
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
						options={directions}
						value={lighting.direction}
						fill
						onchange={(direction) => writeByte(LightingOffset.direction, direction)}
					/>
				{/if}
				{#if controls.rainbow}
					<Switch label="Rainbow instead of one colour" checked={lighting.colorful} onchange={(on) => writeByte(LightingOffset.colorful, on ? 1 : 0)} />
				{/if}
				{#if controls.color}
					<ColorField
						label="Colour"
						value={lighting.color}
						disabled={controls.rainbow && lighting.colorful}
						onchange={(color) => void connection.applyLighting(colorFields(color))}
					/>
				{/if}
				{#if controls.preset}
					<SwatchPicker
						label="Colour"
						colors={PRESET_SWATCHES}
						value={PRESETS[lighting.preset]?.color ?? ''}
						onchange={(color) => writeByte(LightingOffset.preset, PRESETS.findIndex((preset) => preset.color === color))}
					/>
				{/if}
				{#if lighting.mode === MODE_CUSTOM}
					<Hint>This effect shows the colours set under <a href={resolve('/colors')}>Key colours</a>.</Hint>
				{:else if !hasSettings}
					<Hint>This effect has no settings besides brightness.</Hint>
				{/if}
			</div>
		</Card>
	</div>
</div>

<style>
	.lighting {
		display: grid;
		align-items: start;
		gap: var(--space-6);
	}

	.controls {
		display: grid;
		gap: var(--space-5);
	}

	@container content (min-width: 52rem) {
		.lighting {
			grid-template-columns: minmax(0, 1fr) 20rem;
		}

		.settings {
			position: sticky;
			top: calc(var(--sticky-offset, 0px) + var(--space-6));
		}
	}
</style>
