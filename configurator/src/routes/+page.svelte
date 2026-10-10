<script lang="ts">
	/**
	 * @file +page.svelte
	 * @brief Lighting screen: the keyboard's identity and active profile, and the lighting editor.
	 * @note Rendered only while connected; the root layout shows the connect screen otherwise.
	 */
	import { RefreshCw, Unplug } from '@lucide/svelte';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { hex16 } from '#lib/ck108/protocol.ts';
	import LightingPanel from '#lib/lighting/LightingPanel.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';

	const connection = getConnection(); // shared connection from the layout
</script>

<svelte:head>
	<title>Lighting - CK108 Configurator</title>
</svelte:head>

<div class="grid">
	<Card title="Device">
		{#snippet actions()}
			<Button variant="ghost" onclick={() => connection.refresh()} aria-label="Read settings again" title="Read settings again">
				<RefreshCw size={16} aria-hidden="true" />
			</Button>
			<Button variant="ghost" onclick={() => connection.disconnect()}>
				<Unplug size={16} aria-hidden="true" />
				Disconnect
			</Button>
		{/snippet}
		{#if connection.info}
			{@const info = connection.info}
			<dl>
				<dt>Keyboard</dt>
				<dd>MotoSpeed CK108 <span class="mono">{hex16(info.vendorId)}:{hex16(info.productId)}</span></dd>
				<dt>Firmware</dt>
				<dd class="mono">0x{hex16(info.firmware)}</dd>
				<dt>Active profile</dt>
				<dd>Profile {info.profile + 1}</dd>
			</dl>
		{:else}
			<p>Reading...</p>
		{/if}
	</Card>

	{#if connection.info && connection.lighting}
		<LightingPanel lighting={connection.lighting} modes={connection.info.modes} />
	{/if}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--space);
		align-items: start;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 8px 20px;
		margin: 0;
	}

	dt,
	p {
		color: var(--text-muted);
	}

	dd,
	p {
		margin: 0;
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 13px;
	}
</style>
