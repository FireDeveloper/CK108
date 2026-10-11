<script lang="ts">
	/**
	 * @file ReadingState.svelte
	 * @brief Placeholder while a page waits for the keyboard's settings: a spinner while they are read, or a retry once a read has failed.
	 */
	import { RefreshCw, TriangleAlert } from '@lucide/svelte';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';

	const connection = getConnection(); // shared connection from the layout
	let retrying = $state(false); // a new read in flight

	/** @brief Read every setting from the keyboard again. */
	async function retry(): Promise<void> {
		retrying = true; // spinner instead of the failure
		try {
			await connection.refresh(); // every block read again
		} finally {
			retrying = false; // show the outcome
		}
	}
</script>

{#if connection.error && !retrying}
	<EmptyState title="Could not read the keyboard" icon={TriangleAlert}>
		If this keeps happening, unplug the keyboard and plug it back in.
		{#snippet actions()}
			<Button onclick={retry}>
				<RefreshCw aria-hidden="true" />
				Try again
			</Button>
		{/snippet}
	</EmptyState>
{:else}
	<EmptyState busy title="Reading the keyboard" />
{/if}
