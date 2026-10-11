<script lang="ts">
	/**
	 * @file Spinner.svelte
	 * @brief Shared busy indicator: a turning ring, announced to screen readers only when it has a label.
	 */
	import { LoaderCircle } from '@lucide/svelte';

	interface Props {
		size?: number;
		label?: string;
	}

	let { size = 16, label }: Props = $props(); // ring size in px, spoken text
</script>

<span class="spinner" role={label ? 'status' : undefined} aria-hidden={label ? undefined : 'true'}>
	<LoaderCircle {size} aria-hidden="true" />
	{#if label}<span class="visually-hidden">{label}</span>{/if}
</span>

<style>
	.spinner {
		display: inline-flex;
		flex: none;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
</style>
