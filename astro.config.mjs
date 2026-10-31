// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import githubDark from '@shikijs/themes/github-dark';
import { rehypeTableWrap } from './src/plugins/rehype-table-wrap.mjs';
import { rehypeBasePath } from './src/plugins/rehype-base-path.mjs';

// github-dark's comment colour is #6a737d, which measures 3.04:1 against the theme's own
// card background — axe flags every commented line in the docs as a serious WCAG 1.4.3
// failure. Two edits, both of which the palette wanted anyway: comments take --fg-muted
// (#8b98a5, 6.66:1 on the code background), and the fence background takes --code-bg
// (#080c11) so code blocks match inline code and the install block instead of rendering
// the editor's grey card. Darkening the background only ever raises contrast for the
// remaining tokens, which are all lighter than both backgrounds.
const COMMENT_FG = '#8b98a5';
const shikiTheme = {
	...githubDark,
	name: 'github-dark-site',
	colors: { ...githubDark.colors, 'editor.background': '#080c11' },
	tokenColors: githubDark.tokenColors.map((entry) =>
		entry.settings?.foreground?.toLowerCase() === '#6a737d'
			? { ...entry, settings: { ...entry.settings, foreground: COMMENT_FG } }
			: entry,
	),
};

// https://astro.build/config
export default defineConfig({
	// The canonical host. The LAN default is what Jenkins builds; SITE_URL overrides it,
	// which is how the GitHub Pages workflow points the same source at the public host
	// without editing this file. (The repo went public at v0.3.0; the comment that used to
	// live here claimed it never would be.)
	//
	// This must never resolve to undefined: src/layouts/Layout.astro does
	// `new URL(Astro.url.pathname, Astro.site)`, which throws on an undefined base — so a
	// missing value fails the build rather than quietly emitting wrong canonical tags.
	site: process.env.SITE_URL ?? 'https://flawless-react.in.drlario.org',
	// A GitHub Pages *project* site lives under /<repo>. Unset everywhere else, including
	// the LAN vhost, which serves from the domain root. Astro does not rewrite hrefs in
	// markup for a base, so src/plugins/rehype-base-path.mjs does that job.
	base: process.env.BASE_PATH ?? '/',
	// `gfm: true` is not the default for @astrojs/mdx (it pushes remark-gfm only when
	// the option is truthy), so without it every `| … |` table in the docs — the CLI
	// flag table first of all — is emitted as literal pipe characters in a paragraph.
	// `rehypeTableWrap` then gives those tables the scroll container they need on a phone.
	integrations: [mdx({ gfm: true, rehypePlugins: [rehypeTableWrap, rehypeBasePath] }), sitemap()],
	markdown: {
		shikiConfig: {
			theme: shikiTheme,
			langs: ['bash', 'sh', 'shell', 'typescript', 'ts', 'tsx', 'json', 'yaml'],
			wrap: true,
		},
	},
});
