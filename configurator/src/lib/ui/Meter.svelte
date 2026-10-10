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
		<span>{label}</span>
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
		gap: 12px;
		font-size: 13px;
	}

	.reading {
		color: var(--text-muted);
	}

	.track {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-raised);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--accent);
	}

	.warn .fill {
		background: var(--warn);
	}

	.danger .fill {
		background: var(--danger);
	}
</style>
