<script lang="ts">
	/**
	 * @file Meter.svelte
	 * @brief Shared fill gauge with a label and a text reading, e.g. storage used out of a capacity.
	 * @note The bar turns to the warning colour above 90 percent and to the danger colour when value exceeds max.
	 */
	interface Props {
		label: string;
		value: number;
		max: number;
		reading: string;
	}

	let { label, value, max, reading }: Props = $props(); // gauge label, amount, capacity, text shown beside it

	const ratio = $derived(max > 0 ? value / max : 1); // filled fraction, may exceed 1
	const tone = $derived(ratio > 1 ? 'danger' : ratio > 0.9 ? 'warn' : 'ok'); // bar colour band
</script>

<div class="meter">
	<div class="top">
		<span class="label">{label}</span>
		<span class="reading">{reading}</span>
	</div>
	<div class={['track', tone]} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={reading}>
		<div class="fill" style:width="{Math.min(ratio, 1) * 100}%"></div>
	</div>
</div>

<style>
	.meter {
		display: grid;
		gap: 6px;
	}

	.top {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		font-size: var(--text-sm);
	}

	.label {
		font-weight: var(--weight-medium);
	}

	.reading {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.track {
		height: 6px;
		overflow: hidden;
		border-radius: var(--radius-full);
		background: var(--surface-inset);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.fill {
		height: 100%;
		border-radius: inherit;
		background: var(--text);
		transition: width var(--duration-base) var(--ease-standard);
	}

	.warn .fill {
		background: var(--warn);
	}

	.danger .fill {
		background: var(--danger);
	}
</style>
