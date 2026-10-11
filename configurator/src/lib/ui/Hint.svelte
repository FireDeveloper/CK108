<script lang="ts">
	/**
	 * @file Hint.svelte
	 * @brief Shared helper text: a short muted paragraph without margins; the parent spaces it.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props(); // text, may hold links
</script>

<p class="hint">{@render children()}</p>

<style>
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		color: var(--text-muted);
	}

	.hint :global(a) {
		color: var(--text);
	}
</style>
