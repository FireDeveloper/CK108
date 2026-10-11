<script lang="ts">
	/**
	 * @file AppShell.svelte
	 * @brief Shared app frame: a sidebar with brand, device, navigation and footer on wide screens, a top bar with tabs and a menu panel on narrow ones.
	 * @note The menu panel closes by itself when the window grows past the sidebar breakpoint, where the sidebar shows the same content.
	 * @note The content area is the container named content, so components can adapt to its width with container queries.
	 */
	import { Menu } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		brand: Snippet;
		status?: Snippet;
		device?: Snippet;
		nav?: Snippet<['vertical' | 'horizontal']>;
		footer?: Snippet;
		children: Snippet;
	}

	let { brand, status, device, nav, footer, children }: Props = $props(); // frame parts, page content

	const WIDE = '(min-width: 64rem)'; // sidebar breakpoint, as in the stylesheet below
	let menuOpen = $state(false); // narrow-screen menu panel

	$effect(() => {
		const wide = window.matchMedia(WIDE); // sidebar breakpoint
		const closeWhenWide = () => {
			if (wide.matches) menuOpen = false; // the sidebar now shows the panel's content
		};
		wide.addEventListener('change', closeWhenWide); // follow window resizes
		return () => wide.removeEventListener('change', closeWhenWide); // stop following
	});
</script>

<a class="skip" href="#main">Skip to content</a>

<div class="shell">
	<aside class="sidebar">
		<div class="brand">{@render brand()}</div>
		{#if device}{@render device()}{/if}
		{#if nav}{@render nav('vertical')}{/if}
		{#if footer}<div class="footer">{@render footer()}</div>{/if}
	</aside>

	<header class="topbar">
		<div class="topbar-row">
			<div class="brand">{@render brand()}</div>
			{#if status}{@render status()}{/if}
			<Button variant="ghost" iconOnly aria-label="Open menu" title="Menu" onclick={() => (menuOpen = true)}>
				<Menu aria-hidden="true" />
			</Button>
		</div>
		{#if nav}{@render nav('horizontal')}{/if}
	</header>

	<main id="main" tabindex="-1">
		<div class="content">{@render children()}</div>
	</main>
</div>

<Dialog open={menuOpen} title="Menu" placement="end" onclose={() => (menuOpen = false)}>
	<div class="drawer">
		{#if device}{@render device()}{/if}
		{#if footer}<div class="footer">{@render footer()}</div>{/if}
	</div>
</Dialog>

<style>
	.skip {
		position: fixed;
		top: var(--space-2);
		left: var(--space-2);
		z-index: var(--z-skip);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-text);
		font-weight: var(--weight-medium);
		text-decoration: none;
		translate: 0 -200%;
		transition: translate var(--duration-fast) var(--ease-standard);
	}

	.skip:focus {
		translate: 0 0;
	}

	.shell {
		--sticky-offset: calc(var(--topbar-height) + 2.75rem);
		min-height: 100dvh;
	}

	.sidebar {
		display: none;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-topbar);
		border-bottom: 1px solid var(--border);
		background: var(--bg-sidebar);
	}

	.topbar-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--topbar-height);
		padding: 0 var(--space-2) 0 var(--space-4);
	}

	.topbar-row .brand {
		flex: 1;
		min-width: 0;
	}

	main {
		outline: none;
	}

	.content {
		container: content / inline-size;
		display: grid;
		gap: var(--space-6);
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--space-6) var(--space-4) var(--space-12);
	}

	.footer {
		display: grid;
		gap: var(--space-3);
	}

	.drawer {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 64rem) {
		.shell {
			--sticky-offset: 0px;
			display: grid;
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
		}

		.sidebar {
			position: sticky;
			top: 0;
			display: flex;
			flex-direction: column;
			gap: var(--space-5);
			height: 100dvh;
			padding: var(--space-4) var(--space-3);
			overflow-y: auto;
			border-right: 1px solid var(--border);
			background: var(--bg-sidebar);
		}

		.sidebar .brand {
			padding: var(--space-1) var(--space-1) 0;
		}

		.sidebar .footer {
			margin-top: auto;
			padding-top: var(--space-4);
			border-top: 1px solid var(--border);
		}

		.topbar {
			display: none;
		}

		.content {
			padding: var(--space-8) var(--space-6) var(--space-12);
		}
	}

	@media (min-width: 80rem) {
		.content {
			padding-inline: var(--space-10);
		}
	}
</style>
