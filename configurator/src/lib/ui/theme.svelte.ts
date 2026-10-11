/**
 * @file theme.svelte.ts
 * @brief Light, dark or system theme: the choice every theme switch shares, remembered in this browser and applied to the document.
 * @note app.html applies a stored choice before first paint; load() picks it up once the page runs.
 */

//& Public Variables

/** @brief Theme choice: follow the system, or force light or dark. */
export type ThemeChoice = 'system' | 'light' | 'dark';

//& Private Variables

const STORAGE_KEY = 'ck108-theme'; // localStorage key, also read by the app.html script
const CHROME = { light: '#f5f5f5', dark: '#0f0f0f' }; // browser chrome colour per theme, the --bg-sidebar of each in app.css

//& Public Functions

/** @brief Shared theme state; switches read choice and call set(). */
class Theme {
	choice = $state<ThemeChoice>('system'); // current choice

	/** @brief Take over the choice app.html applied from storage. */
	load(): void {
		const forced = document.documentElement.dataset.theme; // set by the app.html script
		this.choice = forced === 'light' || forced === 'dark' ? forced : 'system'; // matching choice
	}

	/**
	 * @brief Apply a choice to the page and remember it in this browser.
	 * @param[in] choice New theme choice.
	 */
	set(choice: ThemeChoice): void {
		//- Remember it for the next visit
		try {
			if (choice === 'system') localStorage.removeItem(STORAGE_KEY); // follow the system again
			else localStorage.setItem(STORAGE_KEY, choice); // forced theme
		} catch {
			//? Storage access throws when the browser blocks it; the choice then lasts for this visit only.
		}

		//- Apply it to the page and the browser chrome
		const root = document.documentElement; // element app.css reads data-theme from
		if (choice === 'system') delete root.dataset.theme; // the media query decides
		else root.dataset.theme = choice; // forced theme
		for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
			const scheme = choice === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : choice; // scheme this tag paints
			meta.content = CHROME[scheme]; // address bar colour
		}
		this.choice = choice; // every switch follows
	}
}

export const theme = new Theme(); // the page's one theme state
