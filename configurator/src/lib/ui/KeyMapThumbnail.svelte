<script lang="ts">
	/**
	 * @file KeyMapThumbnail.svelte
	 * @brief Shared still picture of a keyboard: every key a rectangle in its colour on a dark deck, the way a backlit keyboard looks in the dark.
	 * @note Rectangles may use any unit; the picture keeps their proportions and fills its container's width.
	 * @note The picture is hidden from assistive technology; the control around it names what it shows.
	 */

	interface ThumbnailKey {
		id: number;
		x: number;
		y: number;
		w: number;
		h: number;
		color: string;
	}

	interface Props {
		keys: readonly ThumbnailKey[];
	}

	let { keys }: Props = $props(); // keys to draw

	//? Neighbouring keys are only a few units apart, which vanishes at thumbnail size, so every key shrinks by a share of the shortest key's height.
	const GAP_SHARE = 0.12; // inset on each side of a key
	const PAD_SHARE = 0.4; // deck margin around the outermost keys
	const shortest = $derived(Math.min(...keys.map((key) => key.h))); // shortest key height in drawing units
	const gap = $derived(shortest * GAP_SHARE); // inset per side in drawing units
	const viewBox = $derived.by(() => {
		const pad = shortest * PAD_SHARE; // deck margin in drawing units
		const left = Math.min(...keys.map((key) => key.x)) - pad; // left edge of the picture
		const top = Math.min(...keys.map((key) => key.y)) - pad; // top edge of the picture
		const right = Math.max(...keys.map((key) => key.x + key.w)) + pad; // right edge of the picture
		const bottom = Math.max(...keys.map((key) => key.y + key.h)) + pad; // bottom edge of the picture
		return `${left} ${top} ${right - left} ${bottom - top}`; // SVG view box
	}); // picture box around every key
</script>

<svg class="thumbnail" {viewBox} aria-hidden="true">
	{#each keys as key (key.id)}
		<rect x={key.x + gap} y={key.y + gap} width={key.w - 2 * gap} height={key.h - 2 * gap} rx={gap} fill={key.color} />
	{/each}
</svg>

<style>
	.thumbnail {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		background: var(--backlight-deck);
	}

	rect {
		stroke: var(--backlight-key-edge);
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
</style>
