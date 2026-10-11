<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Macros screen: the stored macros and the macro editor.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import ReadingState from '#lib/device/ReadingState.svelte';
	import MacroEditor from '#lib/macros/MacroEditor.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

{#if connection.info && connection.keymaps && connection.defaultKeymap && connection.macros}
	<MacroEditor
		macros={connection.macros}
		keymaps={connection.keymaps}
		defaults={connection.defaultKeymap}
		profile={connection.info.profile}
		space={connection.info.macroSpace}
		hasNames={connection.hasMacroNames}
	/>
{:else}
	<ReadingState />
{/if}
