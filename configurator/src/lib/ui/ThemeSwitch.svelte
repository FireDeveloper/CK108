<script lang="ts">
	/**
	 * @file ThemeSwitch.svelte
	 * @brief Shared theme choice: follow the system, or force light or dark; remembered in this browser.
	 */
	import { Monitor, Moon, Sun, type LucideIcon } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import { theme, type ThemeChoice } from './theme.svelte.ts';

	const OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
		{ value: 'system', label: 'System theme', icon: Monitor },
		{ value: 'light', label: 'Light theme', icon: Sun },
		{ value: 'dark', label: 'Dark theme', icon: Moon }
	]; // theme choices, named for screen readers and tooltips

	onMount(() => theme.load()); // take over the choice app.html applied
</script>

<SegmentedControl label="Theme" options={OPTIONS} value={theme.choice} layout="inline" size="sm" iconOnly onchange={(choice) => theme.set(choice)} />
