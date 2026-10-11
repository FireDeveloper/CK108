<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Key colours screen: the per-key colour editor for the custom effect.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import ReadingState from '#lib/device/ReadingState.svelte';
	import KeyColorEditor from '#lib/key-colors/KeyColorEditor.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

{#if connection.info && connection.keyColors && connection.lighting}
	<KeyColorEditor colors={connection.keyColors} mode={connection.lighting.mode} profile={connection.info.profile} />
{:else}
	<ReadingState />
{/if}
