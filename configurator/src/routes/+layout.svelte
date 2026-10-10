<script lang="ts">
	/**
	 * @file +layout.svelte
	 * @brief App shell: design tokens, the shared Connection, header with section tabs and status, and the connect screen that gates every page.
	 */
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { Keyboard, Plug } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Connection, setConnection, type Status } from '#lib/ck108/connection.svelte.ts';
	import Alert from '#lib/ui/Alert.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import NavTabs from '#lib/ui/NavTabs.svelte';
	import StatusPill from '#lib/ui/StatusPill.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props(); // page content

	const PILLS: Record<Status, { tone: 'neutral' | 'ok' | 'warn' | 'danger'; label: string }> = {
		checking: { tone: 'neutral', label: 'Starting' },
		unsupported: { tone: 'danger', label: 'WebHID unavailable' },
		disconnected: { tone: 'neutral', label: 'Not connected' },
		connecting: { tone: 'warn', label: 'Connecting' },
		connected: { tone: 'ok', label: 'Connected' }
	}; // status -> header badge
	const SAVING = { tone: 'warn', label: 'Saving' } as const; // header badge while a write is in flight

	const connection = new Connection(); // one connection for every page
	setConnection(connection); // share it with the pages
	const pill = $derived(connection.pending > 0 ? SAVING : PILLS[connection.status]); // badge for the current status
	const sections = $derived([
		{ href: resolve('/'), label: 'Lighting', current: page.url.pathname === resolve('/') },
		{ href: resolve('/colors'), label: 'Key colours', current: page.url.pathname === resolve('/colors') },
		{ href: resolve('/keys'), label: 'Keys', current: page.url.pathname === resolve('/keys') },
		{ href: resolve('/macros'), label: 'Macros', current: page.url.pathname === resolve('/macros') },
		{ href: resolve('/backup'), label: 'Backup', current: page.url.pathname === resolve('/backup') }
	]); // header tabs, current page marked

	onMount(() => connection.start()); // WebHID setup in the browser; returns the cleanup
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<div class="brand">
		<Keyboard size={22} aria-hidden="true" />
		<span>CK108 Configurator</span>
	</div>
	{#if connection.status === 'connected'}
		<NavTabs label="Sections" items={sections} />
	{/if}
	<StatusPill tone={pill.tone} label={pill.label} />
</header>

<main>
	{#if connection.status === 'unsupported'}
		<Alert title="This browser cannot talk to the keyboard">
			WebHID is only available in Chrome, Edge and other Chromium browsers, on an https:// or localhost address.
		</Alert>
	{/if}

	{#if connection.error}
		<Alert tone="danger" title="Something went wrong">{connection.error}</Alert>
	{/if}

	{#if connection.status === 'disconnected' || connection.status === 'connecting'}
		<Card>
			<div class="intro">
				<h1>Connect your MotoSpeed CK108</h1>
				<p>
					Your browser lists the keyboard in a device picker; choose it to read its settings. After the first time, this page
					reconnects on its own.
				</p>
				<Button variant="primary" onclick={() => connection.connect()} disabled={connection.status === 'connecting'}>
					<Plug size={16} aria-hidden="true" />
					{connection.status === 'connecting' ? 'Connecting...' : 'Connect keyboard'}
				</Button>
			</div>
		</Card>
	{:else if connection.status === 'connected'}
		{@render children()}
	{/if}
</main>

<footer>Changes are written to the keyboard as you make them, and stay on it after you close this page.</footer>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 12px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		letter-spacing: 0.01em;
	}

	header > :global(:last-child) {
		margin-left: auto;
	}

	main {
		display: grid;
		gap: var(--space);
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px;
	}

	.intro {
		display: grid;
		justify-items: start;
		gap: 12px;
		padding: 12px 4px;
	}

	h1 {
		margin: 0;
		font-size: 22px;
	}

	p {
		margin: 0;
		max-width: 60ch;
		color: var(--text-muted);
	}

	footer {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 24px 24px;
		color: var(--text-muted);
		font-size: 13px;
	}
</style>
