<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Keys screen: the key remap editor for the profile the keyboard is using.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import ReadingState from '#lib/device/ReadingState.svelte';
	import RemapEditor from '#lib/remap/RemapEditor.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

{#if connection.info && connection.keymaps && connection.defaultKeymap && connection.macros}
	{@const profile = connection.info.profile}
	<RemapEditor
		{profile}
		keymap={connection.keymaps[profile]}
		defaults={connection.defaultKeymap}
		macroNames={connection.macros.map((macro) => macro.name)}
	/>
{:else}
	<ReadingState />
{/if}
