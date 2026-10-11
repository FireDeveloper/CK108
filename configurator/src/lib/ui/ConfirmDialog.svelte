<script lang="ts">
	/**
	 * @file ConfirmDialog.svelte
	 * @brief Shared confirmation for an action that replaces or removes something: a question, a short explanation, then Cancel and the action.
	 * @note Keep it mounted and toggle open, so focus returns to the button that opened it; Cancel takes focus first, as the safe choice.
	 */
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		open: boolean;
		title: string;
		confirmLabel: string;
		cancelLabel?: string;
		tone?: 'danger' | 'neutral';
		onconfirm: () => void;
		oncancel: () => void;
		children?: Snippet;
	}

	let { open, title, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', onconfirm, oncancel, children }: Props = $props(); // state, question, button texts, look, callbacks, explanation
</script>

<Dialog {open} {title} onclose={oncancel}>
	{#if children}{@render children()}{/if}
	{#snippet footer()}
		<Button autofocus onclick={oncancel}>{cancelLabel}</Button>
		<Button variant={tone === 'danger' ? 'danger' : 'primary'} onclick={onconfirm}>{confirmLabel}</Button>
	{/snippet}
</Dialog>
