import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: {
				//? GitHub Pages serves the site under /<repo>/, so the deploy workflow sets BASE_PATH; local builds leave it empty.
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}` // URL prefix of every page and asset
			}
		})
	],
	server: {
		fs: {
			//? The key layout table lives in ../ck108/, shared with the Python reference driver, outside the dev server's default root.
			allow: ['../ck108'] // serve the shared layout table
		}
	}
});
