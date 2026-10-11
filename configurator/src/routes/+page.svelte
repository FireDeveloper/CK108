<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Lighting screen: the effect gallery and the settings the chosen effect uses.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import ReadingState from '#lib/device/ReadingState.svelte';
	import LightingPanel from '#lib/lighting/LightingPanel.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

{#if connection.info && connection.lighting}
	<LightingPanel lighting={connection.lighting} modes={connection.info.modes} />
{:else}
	<ReadingState />
{/if}
