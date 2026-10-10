<script lang="ts">
	/**
	 * @file FileButton.svelte
	 * @brief Shared button that opens the browser's file picker and reports the chosen file.
	 * @note The same file can be chosen twice in a row; the picker is cleared after each choice.
	 */
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		accept?: string;
		variant?: 'primary' | 'secondary' | 'ghost';
		disabled?: boolean;
		children: Snippet;
		onfile: (file: File) => void;
	}

	let { accept, variant = 'secondary', disabled = false, children, onfile }: Props = $props(); // file types, look, content, choice callback
	let input: HTMLInputElement | undefined = $state(); // hidden file input
</script>

<input
	bind:this={input}
	type="file"
	{accept}
	hidden
	onchange={(event) => {
		const file = event.currentTarget.files?.[0]; // chosen file, if any
		event.currentTarget.value = ''; // allow choosing the same file again
		if (file) onfile(file); // report it
	}}
/>
<Button {variant} {disabled} onclick={() => input?.click()}>
	{@render children()}
</Button>
