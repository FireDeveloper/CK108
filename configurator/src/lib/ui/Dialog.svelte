<script lang="ts">
	/**
	 * @file Dialog.svelte
	 * @brief Shared modal dialog on the native dialog element, centred or as a side panel; Escape, a backdrop click and the close button report through onclose.
	 * @note While it is open the page behind is inert and does not scroll; focus returns to the opener when it closes.
	 */
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		placement?: 'center' | 'end';
		size?: 'sm' | 'md';
		onclose: () => void;
		children?: Snippet;
		footer?: Snippet;
	}

	let { open, title, description, placement = 'center', size = 'sm', onclose, children, footer }: Props = $props(); // state, texts, layout, callbacks, content
	const id = $props.id(); // ties the heading and description to the dialog
	let dialog: HTMLDialogElement | undefined = $state(); // the dialog element

	$effect(() => {
		if (!dialog) return; // not mounted yet
		if (open && !dialog.open) dialog.showModal(); // top layer, page inert, focus moves in
		else if (!open && dialog.open) dialog.close(); // focus returns to the opener
	});

	/**
	 * @brief Close on a click outside the panel, for browsers that do not support closedby.
	 * @param[in] event Click on the dialog; its target is the dialog itself only on the backdrop.
	 */
	function backdropClick(event: MouseEvent): void {
		if (event.target === dialog) onclose(); // the panel covers the dialog box, so this is the backdrop
	}
</script>

<dialog
	bind:this={dialog}
	class={['dialog', placement, size]}
	aria-labelledby="{id}-title"
	aria-describedby={description ? `${id}-description` : undefined}
	closedby="any"
	onclose={() => open && onclose()}
	onclick={backdropClick}
>
	<div class="panel">
		<header>
			<div class="heading">
				<h2 id="{id}-title">{title}</h2>
				{#if description}<p id="{id}-description">{description}</p>{/if}
			</div>
			<Button variant="ghost" size="sm" iconOnly aria-label="Close" title="Close" onclick={onclose}>
				<X aria-hidden="true" />
			</Button>
		</header>
		{#if children}<div class="body">{@render children()}</div>{/if}
		{#if footer}<footer>{@render footer()}</footer>{/if}
	</div>
</dialog>

<style>
	.dialog {
		width: min(26rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-lg);
		opacity: 1;
		translate: 0 0;
		transition:
			opacity var(--duration-base) var(--ease-out),
			translate var(--duration-base) var(--ease-out);
	}

	.dialog.md {
		width: min(32rem, calc(100vw - 2rem));
	}

	.dialog::backdrop {
		background: var(--backdrop, rgb(0 0 0 / 0.5));
		opacity: 1;
		transition: opacity var(--duration-base) var(--ease-out);
	}

	.dialog.end {
		width: min(20rem, calc(100vw - 3rem));
		height: 100dvh;
		max-height: none;
		margin: 0 0 0 auto;
		border-width: 0 0 0 1px;
		border-radius: 0;
	}

	@starting-style {
		.dialog[open] {
			opacity: 0;
			translate: 0 8px;
		}

		.dialog.end[open] {
			opacity: 1;
			translate: 100% 0;
		}

		.dialog[open]::backdrop {
			opacity: 0;
		}
	}

	.panel {
		display: grid;
		align-content: start;
		gap: var(--space-4);
		max-height: inherit;
		padding: var(--space-5);
		overflow-y: auto;
	}

	.end .panel {
		height: 100%;
		padding: var(--space-4);
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.heading {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	h2 {
		font-size: var(--text-lg);
	}

	.heading p {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.body {
		display: grid;
		gap: var(--space-3);
		color: var(--text-muted);
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	:global(html:has(dialog[open]:modal)) {
		overflow: hidden;
	}
</style>
