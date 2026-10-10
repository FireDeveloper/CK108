<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Key colours screen: the per-key colour editor for the custom effect.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import KeyColorEditor from '#lib/key-colors/KeyColorEditor.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

<svelte:head>
	<title>Key colours - CK108 Configurator</title>
</svelte:head>

{#if connection.keyColors && connection.lighting}
	<KeyColorEditor colors={connection.keyColors} mode={connection.lighting.mode} />
{:else}
	<p>Reading...</p>
{/if}

<style>
	p {
		margin: 0;
		color: var(--text-muted);
	}
</style>
