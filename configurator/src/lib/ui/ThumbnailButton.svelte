<script lang="ts">
	/**
	 * @file ThumbnailButton.svelte
	 * @brief Shared gallery button: a picture above a label; the button for the choice in effect is outlined and checked.
	 * @note The picture is decorative, so the label alone names the button; the choice in effect is announced through aria-current.
	 */
	import { Check } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		current?: boolean;
		disabled?: boolean;
		onclick: () => void;
		children: Snippet;
	}

	let { label, current = false, disabled = false, onclick, children }: Props = $props(); // name, in-effect flag, availability, action, picture
</script>

<button type="button" class={['thumbnail-button', { current }]} aria-current={current ? 'true' : undefined} {disabled} {onclick}>
	<span class="picture">{@render children()}</span>
	<span class="caption">
		<span class="label">{label}</span>
		{#if current}
			<span class="mark" aria-hidden="true"><Check size={10} strokeWidth={4} /></span>
		{/if}
	</span>
</button>

<style>
	.thumbnail-button {
		display: grid;
		gap: var(--space-2);
		width: 100%;
		padding: 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		text-align: start;
		cursor: pointer;
		user-select: none;
		transition:
			background-color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard),
			box-shadow var(--duration-fast) var(--ease-standard),
			translate var(--duration-fast) var(--ease-standard);
	}

	.thumbnail-button:hover:not(:disabled, .current) {
		border-color: var(--border-strong);
		background: var(--fill-hover);
	}

	.thumbnail-button:active:not(:disabled) {
		translate: 0 1px;
	}

	.thumbnail-button.current {
		border-color: var(--text);
		background: var(--fill-selected);
		box-shadow: inset 0 0 0 1px var(--text);
	}

	.thumbnail-button:disabled {
		opacity: var(--disabled-opacity);
		cursor: not-allowed;
	}

	.picture {
		display: block;
	}

	.caption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: 16px;
		padding: 0 2px 2px;
	}

	.label {
		min-width: 0;
		overflow: hidden;
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		line-height: var(--leading-snug);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.current .label {
		font-weight: var(--weight-semibold);
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--accent-text);
	}
</style>
