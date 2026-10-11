<script lang="ts">
	/**
	 * @file KeyMap.svelte
	 * @brief Shared keyboard drawing: keycaps placed by rectangle, filled with a colour or drawn plain, selected by click, drag, or Enter/Space on a focused key.
	 * @note Rectangles may use any unit; the drawing scales them to its width, keeps their proportions, and scrolls sideways below a minimum width.
	 * @note With multiple off, a press selects that key alone and drags do nothing.
	 * @note A selected plain key is drawn inverted, a selected coloured key gets an inner ring in its text colour, and a marked key carries a dot.
	 */
	import { inkFor } from './ink.ts';

	interface MapKey {
		id: number;
		name: string;
		label: string;
		x: number;
		y: number;
		w: number;
		h: number;
		color?: string;
		marked?: boolean;
		detail?: string;
	}

	interface Props {
		label: string;
		keys: readonly MapKey[];
		selected: ReadonlySet<number>;
		multiple?: boolean;
		onselect: (id: number, selected: boolean) => void;
	}

	let { label, keys, selected, multiple = true, onselect }: Props = $props(); // keys to draw, current selection, selection mode, selection callback

	const PAD = 8; // drawing units around the outermost keys
	const bounds = $derived.by(() => {
		const left = Math.min(...keys.map((key) => key.x)) - PAD; // left edge of the drawing
		const top = Math.min(...keys.map((key) => key.y)) - PAD; // top edge of the drawing
		const right = Math.max(...keys.map((key) => key.x + key.w)) + PAD; // right edge of the drawing
		const bottom = Math.max(...keys.map((key) => key.y + key.h)) + PAD; // bottom edge of the drawing
		return { left, top, width: right - left, height: bottom - top }; // drawing box
	}); // drawing box around every key
	let dragSelects: boolean | null = null; // what a drag does to the keys it crosses; null when no drag is active

	/**
	 * @brief Start a drag on a key and toggle that key.
	 * @param[in] event Pointer press on the key.
	 * @param[in] id Key id.
	 */
	function beginDrag(event: PointerEvent, id: number): void {
		if (event.button !== 0) return; // primary button or touch only
		event.preventDefault(); // no text selection while dragging
		if (!multiple) {
			onselect(id, true); // single choice: pick this key alone
			return; // no drag
		}
		(event.currentTarget as Element).releasePointerCapture(event.pointerId); // let touch drags reach the next key
		dragSelects = !selected.has(id); // the first key decides select or deselect
		onselect(id, dragSelects); // toggle the pressed key
	}

	/**
	 * @brief Apply the active drag to a key the pointer moves onto.
	 * @param[in] id Key id.
	 */
	function extendDrag(id: number): void {
		if (dragSelects !== null && selected.has(id) !== dragSelects) onselect(id, dragSelects); // same action as the first key
	}

	/**
	 * @brief Toggle a key from the keyboard, or pick it when multiple is off; pointer clicks are handled by beginDrag().
	 * @param[in] event Click on the key; detail is 0 for Enter or Space.
	 * @param[in] id Key id.
	 */
	function keyboardToggle(event: MouseEvent, id: number): void {
		if (event.detail === 0) onselect(id, !multiple || !selected.has(id)); // keyboard activation only
	}

	/**
	 * @brief Express a drawing coordinate as a percentage of the drawing box.
	 * @param[in] value Coordinate or size in drawing units.
	 * @param[in] origin Drawing box origin on that axis, 0 for sizes.
	 * @param[in] span Drawing box size on that axis.
	 * @return CSS percentage.
	 */
	function percent(value: number, origin: number, span: number): string {
		return `${((value - origin) / span) * 100}%`; // relative position
	}
</script>

<svelte:window onpointerup={() => (dragSelects = null)} onpointercancel={() => (dragSelects = null)} />

<div class="scroller">
	<div class="map" role="group" aria-label={label} style:aspect-ratio="{bounds.width} / {bounds.height}">
		{#each keys as key (key.id)}
			<button
				type="button"
				class={['key', { selected: selected.has(key.id), coloured: !!key.color, marked: key.marked, single: !multiple }]}
				style:left={percent(key.x, bounds.left, bounds.width)}
				style:top={percent(key.y, bounds.top, bounds.height)}
				style:width={percent(key.w, 0, bounds.width)}
				style:height={percent(key.h, 0, bounds.height)}
				style:--fill={key.color}
				style:--ink={key.color && inkFor(key.color)}
				aria-pressed={selected.has(key.id)}
				aria-label={key.detail ? `${key.name}, ${key.detail}` : key.name}
				title={key.detail ? `${key.name}: ${key.detail}` : key.name}
				onpointerdown={(event) => beginDrag(event, key.id)}
				onpointerenter={() => extendDrag(key.id)}
				onclick={(event) => keyboardToggle(event, key.id)}
			>
				<span class="cap">{key.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.scroller {
		margin: -4px;
		padding: 4px;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
	}

	.map {
		position: relative;
		width: 100%;
		min-width: 640px;
		container-type: inline-size;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-inset);
	}

	.key {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 2px;
		border: 1px solid var(--key-edge);
		border-radius: 5px;
		background: var(--key-face);
		color: var(--text);
		font: var(--weight-medium) clamp(8px, 1.05cqw, 13px) / 1 var(--font-sans);
		box-shadow: var(--shadow-key);
		cursor: pointer;
		user-select: none;
		touch-action: none;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard),
			color var(--duration-fast) var(--ease-standard),
			translate var(--duration-fast) var(--ease-standard);
	}

	.key.single {
		touch-action: manipulation;
	}

	.cap {
		min-width: 0;
		overflow: hidden;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.key.coloured {
		background: var(--fill);
		color: var(--ink);
	}

	@media (hover: hover) {
		.key:hover {
			border-color: var(--text-subtle);
		}
	}

	.key.marked {
		font-weight: 700;
	}

	.key.marked::after {
		content: '';
		position: absolute;
		top: 3px;
		right: 3px;
		width: 5px;
		height: 5px;
		border-radius: var(--radius-full);
		background: currentColor;
	}

	.key.selected {
		z-index: var(--z-raised);
		box-shadow: none;
		translate: 0 1px;
	}

	.key.selected:not(.coloured) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-text);
	}

	.key.selected.coloured {
		box-shadow: inset 0 0 0 2px var(--ink);
	}

	.key:focus-visible {
		z-index: var(--z-focus);
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}
</style>
