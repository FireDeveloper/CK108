<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Backup screen: save every setting to a file and restore from one.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import BackupPanel from '#lib/backup/BackupPanel.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

<svelte:head>
	<title>Backup - CK108 Configurator</title>
</svelte:head>

{#if connection.info && connection.defaultKeymap}
	<BackupPanel firmware={connection.info.firmware} defaults={connection.defaultKeymap} />
{:else}
	<p>Reading...</p>
{/if}

<style>
	p {
		margin: 0;
		color: var(--text-muted);
	}
</style>
