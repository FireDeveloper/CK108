<script lang="ts">
	/**
	 * @file ConnectScreen.svelte
	 * @brief Start screen until a keyboard is connected: why this browser cannot connect, or the button that opens the browser's device picker.
	 * @note The prerendered page shows the starting state; the button enables once WebHID has been checked.
	 */
	import { Keyboard, KeyboardOff, Plug } from '@lucide/svelte';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';

	const connection = getConnection(); // shared connection from the layout
	const isBusy = $derived(connection.status === 'checking' || connection.status === 'connecting'); // nothing to click yet
	const buttonText = $derived(connection.status === 'connecting' ? 'Connecting...' : connection.status === 'checking' ? 'Starting...' : 'Connect keyboard'); // button label for the state
</script>

<div class="connect">
	{#if connection.status === 'unsupported'}
		<EmptyState title="This browser cannot talk to the keyboard" icon={KeyboardOff} heading="h1" size="lg">
			WebHID is only available in Chrome, Edge and other Chromium browsers on a computer, on an https:// or localhost address.
		</EmptyState>
	{:else}
		<EmptyState title="Connect your MotoSpeed CK108" icon={Keyboard} heading="h1" size="lg">
			Choose the keyboard in your browser's device picker to read its settings. After the first time, this page reconnects on its own. Close the
			MotoSpeed app first if it is running.
			{#snippet actions()}
				<Button variant="primary" disabled={isBusy} onclick={() => connection.connect()}>
					{#if isBusy}<Spinner />{:else}<Plug aria-hidden="true" />{/if}
					{buttonText}
				</Button>
			{/snippet}
		</EmptyState>
	{/if}

	{#if connection.error}
		<Alert tone="danger" title="Could not connect">{connection.error}</Alert>
	{/if}
</div>

<style>
	.connect {
		display: grid;
		align-content: center;
		gap: var(--space-4);
		max-width: 34rem;
		min-height: calc(100dvh - 14rem);
		margin: 0 auto;
	}
</style>
