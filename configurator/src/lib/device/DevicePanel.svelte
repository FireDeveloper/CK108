<script lang="ts">
	/**
	 * @file DevicePanel.svelte
	 * @brief The keyboard in the app frame: its name and connection status, its firmware, and the switch for the active profile.
	 * @note A profile change is written at once; further changes are ignored until it lands, so keyboard focus stays on the profile radios.
	 */
	import { Keyboard } from '@lucide/svelte';
	import { getConnection } from '#lib/ck108/connection.svelte.ts';
	import { PROFILES } from '#lib/ck108/keymap.ts';
	import { hex16 } from '#lib/ck108/protocol.ts';
	import Hint from '#lib/ui/Hint.svelte';
	import KeyValueList from '#lib/ui/KeyValueList.svelte';
	import SegmentedControl from '#lib/ui/SegmentedControl.svelte';
	import StatusPill from '#lib/ui/StatusPill.svelte';

	interface Props {
		tone: 'neutral' | 'ok' | 'warn' | 'danger';
		label: string;
		busy?: boolean;
	}

	let { tone, label, busy = false }: Props = $props(); // connection status for the pill

	const PROFILE_OPTIONS = Array.from({ length: PROFILES }, (_, index) => ({ value: index, label: String(index + 1) })); // profile choices, numbered from 1

	const connection = getConnection(); // shared connection from the layout
	let switching = false; // profile write in flight; nothing renders it

	/**
	 * @brief Switch the keyboard to another profile, ignoring requests while one is in flight.
	 * @param[in] next 0..PROFILES-1.
	 */
	async function switchProfile(next: number): Promise<void> {
		if (switching) return; // one switch at a time
		switching = true; // hold further switches
		try {
			await connection.setProfile(next); // switch and read back
		} finally {
			switching = false; // ready again
		}
	}
</script>

<section class="device" aria-label="Keyboard">
	<div class="identity">
		<span class="mark" aria-hidden="true"><Keyboard size={16} /></span>
		<div class="name">
			<span class="model">MotoSpeed CK108</span>
			<StatusPill {tone} {label} {busy} />
		</div>
	</div>
	{#if connection.info}
		<KeyValueList items={[{ term: 'Firmware', detail: `0x${hex16(connection.info.firmware)}`, mono: true }]} />
		<SegmentedControl
			label="Profile"
			options={PROFILE_OPTIONS}
			value={connection.info.profile}
			layout="inline"
			size="sm"
			fill
			onchange={(value) => void switchProfile(value)}
		/>
		<Hint>Each profile has its own lighting, key colours and keys.</Hint>
	{/if}
</section>

<style>
	.device {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: var(--shadow-xs);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 34px;
		height: 34px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-inset);
		color: var(--text-muted);
	}

	.name {
		display: grid;
		justify-items: start;
		gap: 4px;
		min-width: 0;
	}

	.model {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		line-height: var(--leading-tight);
	}
</style>
