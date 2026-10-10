<script lang="ts">
	/**
	 * @file StatusPill.svelte
	 * @brief Shared status badge: a coloured dot and a short label.
	 */
	interface Props {
		tone?: 'neutral' | 'ok' | 'warn' | 'danger';
		label: string;
	}

	let { tone = 'neutral', label }: Props = $props(); // colour and text
</script>

<span class={['pill', tone]}>
	<span class="dot" aria-hidden="true"></span>
	{label}
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		user-select: none;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
	}

	.neutral {
		background: var(--neutral-soft);
		color: var(--text-muted);
	}

	.ok {
		background: var(--ok-soft);
		color: var(--ok);
	}

	.warn {
		background: var(--warn-soft);
		color: var(--warn);
	}

	.danger {
		background: var(--danger-soft);
		color: var(--danger);
	}
</style>
