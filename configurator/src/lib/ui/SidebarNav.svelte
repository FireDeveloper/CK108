<script lang="ts">
	/**
	 * @file SidebarNav.svelte
	 * @brief Shared section navigation: a vertical list of links with icons, or a row of tabs that scrolls sideways; the current page is marked with a bar.
	 */
	import type { LucideIcon } from '@lucide/svelte';

	interface Item {
		href: string;
		label: string;
		icon?: LucideIcon;
		current: boolean;
	}

	interface Props {
		label: string;
		items: readonly Item[];
		orientation?: 'vertical' | 'horizontal';
	}

	let { label, items, orientation = 'vertical' }: Props = $props(); // accessible name, links, layout
</script>

<nav class={['nav', orientation]} aria-label={label}>
	<ul>
		{#each items as item (item.href)}
			{@const Icon = item.icon}
			<li>
				<a href={item.href} aria-current={item.current ? 'page' : undefined}>
					{#if Icon}<Icon size={16} aria-hidden="true" />{/if}
					<span>{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	ul {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		height: 2rem;
		padding: 0 10px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-weight: var(--weight-medium);
		text-decoration: none;
		white-space: nowrap;
		user-select: none;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			color var(--duration-fast) var(--ease-standard);
	}

	a :global(svg) {
		flex: none;
	}

	a:hover {
		background: var(--fill-hover);
		color: var(--text);
	}

	a[aria-current='page'] {
		background: var(--fill-selected);
		color: var(--text);
		font-weight: var(--weight-semibold);
	}

	.vertical a[aria-current='page']::before {
		content: '';
		position: absolute;
		top: 8px;
		bottom: 8px;
		left: 0;
		width: 3px;
		border-radius: 0 var(--radius-full) var(--radius-full) 0;
		background: var(--text);
	}

	.horizontal ul {
		display: flex;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.horizontal a {
		height: 2.75rem;
		border-radius: 0;
	}

	.horizontal a:hover,
	.horizontal a[aria-current='page'] {
		background: none;
	}

	.horizontal a[aria-current='page']::before {
		content: '';
		position: absolute;
		right: 10px;
		bottom: 0;
		left: 10px;
		height: 2px;
		border-radius: 2px 2px 0 0;
		background: var(--text);
	}

	.horizontal a:focus-visible {
		outline-offset: -2px;
	}
</style>
