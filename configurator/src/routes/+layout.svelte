<script lang="ts">
	/**
	 * @file +layout.svelte
	 * @brief App frame: the shared Connection, the sidebar with device, sections and theme, each section's page header and document title, and the connect
	 *        screen that gates every page.
	 * @note This layout owns the only document title, so every prerendered page carries its section's name.
	 */
	import '@fontsource-variable/inter';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ArrowRightLeft, DatabaseBackup, Keyboard, Lightbulb, ListVideo, Palette, RefreshCw, Unplug } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Connection, setConnection } from '#lib/ck108/connection.svelte.ts';
	import ConnectScreen from '#lib/device/ConnectScreen.svelte';
	import DevicePanel from '#lib/device/DevicePanel.svelte';
	import Alert from '#lib/ui/Alert.svelte';
	import AppShell from '#lib/ui/AppShell.svelte';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SidebarNav from '#lib/ui/SidebarNav.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import StatusPill from '#lib/ui/StatusPill.svelte';
	import ThemeSwitch from '#lib/ui/ThemeSwitch.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props(); // page content

	/** @brief What the status pill shows. */
	interface StatusView {
		tone: 'neutral' | 'ok' | 'warn' | 'danger';
		label: string;
		busy: boolean;
	}

	const SAVED_MS = 2000; // how long the pill says Saved after a write lands
	const SECTIONS = [
		{
			path: '/',
			label: 'Lighting',
			icon: Lightbulb,
			description: 'Effect, brightness and colour of the backlight in the active profile. Changes are written to the keyboard as you make them.',
			showsProfile: true
		},
		{
			path: '/colors',
			label: 'Key colours',
			icon: Palette,
			description: 'Paint keys, blend a gradient or pick a ready-made pattern for Custom backlit mode in the active profile. Every change is written to the keyboard at once.',
			showsProfile: true
		},
		{
			path: '/keys',
			label: 'Keys',
			icon: ArrowRightLeft,
			description: 'Pick a key, choose what it sends, then assign it to the active profile.',
			showsProfile: true
		},
		{
			path: '/macros',
			label: 'Macros',
			icon: ListVideo,
			description: 'Key sequences that one key can play. Nothing is written until you save.',
			showsProfile: false
		},
		{
			path: '/backup',
			label: 'Backup',
			icon: DatabaseBackup,
			description: 'Save every setting to a file, or restore chosen parts from one.',
			showsProfile: false
		}
	] as const; // sections in navigation order: link, title, icon, page description, profile badge

	const connection = new Connection(); // one connection for every page
	setConnection(connection); // share it with the pages
	let refreshing = $state(false); // Refresh read in flight
	let justSaved = $state(false); // a write landed moments ago
	let wasPending = false; // writes were in flight at the last check; nothing renders it
	let savedTimer: ReturnType<typeof setTimeout> | undefined; // return from Saved to Connected

	//? Matched by route id, not by URL: resolve() returns relative paths while prerendering, and the route id carries no base path.
	const current = $derived(SECTIONS.find((section) => page.route.id === section.path) ?? null); // section of the page shown
	const pill = $derived(statusView()); // pill tone, label and activity
	const navItems = $derived(
		SECTIONS.map((section) => ({ href: resolve(section.path), label: section.label, icon: section.icon, current: section === current }))
	); // section links, current page marked
	const badge = $derived(current?.showsProfile && connection.info ? `Profile ${connection.info.profile + 1}` : undefined); // active profile, on the pages that edit one

	//? Saved marks a moment rather than a state of the connection, so a timer started when the writes land clears it again.
	$effect(() => {
		//- Writes in flight: Saving takes over
		if (connection.pending > 0) {
			wasPending = true; // remember to report the landing
			justSaved = false; // Saving replaces Saved
			return; // wait for the write to land
		}

		//- A write just landed: show Saved for a moment, unless it failed
		if (!wasPending) return; // nothing landed
		wasPending = false; // this landing is handled
		if (connection.error) return; // the error shows instead
		justSaved = true; // show Saved
		clearTimeout(savedTimer); // restart the moment after quick writes
		savedTimer = setTimeout(() => (justSaved = false), SAVED_MS); // back to Connected
	});

	onMount(() => connection.start()); // WebHID setup in the browser; returns the cleanup

	/**
	 * @brief Choose what the status pill shows for the connection state.
	 * @return Tone, label and whether to show activity.
	 */
	function statusView(): StatusView {
		//- Before a keyboard is connected
		if (connection.status === 'checking') return { tone: 'neutral', label: 'Starting', busy: true }; // WebHID check pending
		if (connection.status === 'unsupported') return { tone: 'danger', label: 'WebHID unavailable', busy: false }; // browser cannot connect
		if (connection.status === 'disconnected') return { tone: 'neutral', label: 'Not connected', busy: false }; // waiting for the user
		if (connection.status === 'connecting') return { tone: 'neutral', label: 'Connecting', busy: true }; // opening the keyboard

		//- Connected
		if (connection.pending > 0) return { tone: 'neutral', label: 'Saving', busy: true }; // writes in flight
		if (connection.error) return { tone: 'danger', label: 'Error', busy: false }; // last operation failed
		if (justSaved) return { tone: 'ok', label: 'Saved', busy: false }; // a write just landed
		return { tone: 'ok', label: 'Connected', busy: false }; // idle
	}

	/** @brief Read every setting from the keyboard again. */
	async function refresh(): Promise<void> {
		refreshing = true; // spinner on the button
		try {
			await connection.refresh(); // every block read again
		} finally {
			refreshing = false; // ready again
		}
	}
</script>

<svelte:head>
	<title>{current ? `${current.label} - CK108 Configurator` : 'CK108 Configurator'}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<AppShell>
	{#snippet brand()}
		<a class="brand" href={resolve('/')}>
			<span class="mark" aria-hidden="true"><Keyboard size={16} /></span>
			<span class="name">CK108 <span class="product">Configurator</span></span>
		</a>
	{/snippet}

	{#snippet status()}
		<StatusPill tone={pill.tone} label={pill.label} busy={pill.busy} />
	{/snippet}

	{#snippet device()}
		<DevicePanel tone={pill.tone} label={pill.label} busy={pill.busy} />
	{/snippet}

	{#snippet nav(orientation: 'vertical' | 'horizontal')}
		{#if connection.status === 'connected'}
			<SidebarNav label="Sections" items={navItems} {orientation} />
		{/if}
	{/snippet}

	{#snippet footer()}
		{#if connection.status === 'connected'}
			<div class="device-actions">
				<Button size="sm" disabled={refreshing} title="Read every setting from the keyboard again" onclick={refresh}>
					{#if refreshing}<Spinner size={14} />{:else}<RefreshCw aria-hidden="true" />{/if}
					Refresh
				</Button>
				<Button variant="ghost" size="sm" onclick={() => connection.disconnect()}>
					<Unplug aria-hidden="true" />
					Disconnect
				</Button>
			</div>
		{/if}
		<ThemeSwitch />
	{/snippet}

	{#if connection.status === 'connected'}
		{#if current}
			<PageHeader title={current.label} description={current.description} {badge} />
		{/if}
		{#if connection.error}
			<Alert tone="danger" title="Something went wrong" ondismiss={() => (connection.error = null)}>{connection.error}</Alert>
		{/if}
		{@render children()}
	{:else}
		<ConnectScreen />
	{/if}
</AppShell>

<style>
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		max-width: 100%;
		color: var(--text);
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-text);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.product {
		color: var(--text-muted);
		font-weight: var(--weight-medium);
	}

	.device-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	@media (max-width: 26.25rem) {
		.product {
			display: none;
		}
	}
</style>
