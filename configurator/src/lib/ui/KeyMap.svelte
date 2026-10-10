<script lang="ts">
	/**
	 * @file KeyMap.svelte
	 * @brief Shared keyboard drawing: keys placed by rectangle, filled with a colour or the theme's key colour, selected by click, drag, or Enter/Space on a focused key.
	 * @note Rectangles may use any unit; the map scales them to its width and keeps their proportions.
	 * @note With multiple off, a press selects that key alone and drags do nothing.
	 * @note A key without a colour takes the theme's key colours; a marked key is tinted with the accent colour.
	 */
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
	 * @brief Pick readable keycap text for a fill colour.
	 * @param[in] color "#rrggbb" fill.
	 * @return Dark text on light fills, light text on dark fills.
	 */
	function inkFor(color: string): string {
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)); // channel values
		return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111' : '#f4f4f4'; // perceived brightness threshold
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

<div class="map" role="group" aria-label={label} style:aspect-ratio="{bounds.width} / {bounds.height}">
	{#each keys as key (key.id)}
		<button
			type="button"
			class={['key', { selected: selected.has(key.id), themed: !key.color, marked: key.marked }]}
			style:left={percent(key.x, bounds.left, bounds.width)}
			style:top={percent(key.y, bounds.top, bounds.height)}
			style:width={percent(key.w, 0, bounds.width)}
			style:height={percent(key.h, 0, bounds.height)}
			style:--fill={key.color}
			style:--ink={key.color && inkFor(key.color)}
			aria-pressed={selected.has(key.id)}
			aria-label={key.name}
			title={key.name}
			onpointerdown={(event) => beginDrag(event, key.id)}
			onpointerenter={() => extendDrag(key.id)}
			onclick={(event) => keyboardToggle(event, key.id)}
		>
			{key.label}
		</button>
	{/each}
</div>

<style>
	.map {
		position: relative;
		width: 100%;
		container-type: inline-size;
		border-radius: var(--radius);
		background: var(--surface-raised);
		border: 1px solid var(--border);
	}

	.key {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		overflow: hidden;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--fill);
		color: var(--ink);
		font: inherit;
		font-size: clamp(8px, 1.05cqw, 13px);
		font-weight: 600;
		white-space: nowrap;
		box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.25);
		cursor: pointer;
		user-select: none;
		touch-action: none;
	}

	.key.themed {
		background: var(--surface);
		color: var(--text);
	}

	.key.marked {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--text);
	}

	.key.selected {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
		z-index: 1;
	}

	.key:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
		z-index: 2;
	}
</style>
