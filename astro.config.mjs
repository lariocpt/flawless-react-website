// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { rehypeTableWrap } from './src/plugins/rehype-table-wrap.mjs';

// https://astro.build/config
export default defineConfig({
	// flawless-react is private and LAN-only, so the canonical host is the internal vhost
	// Caddy serves from /srv/sites/flawless-react-website/current. SITE_URL overrides it,
	// which is how a future public build would point elsewhere without editing this file.
	//
	// This must never resolve to undefined: src/layouts/Layout.astro does
	// `new URL(Astro.url.pathname, Astro.site)`, which throws on an undefined base — so a
	// missing value fails the build rather than quietly emitting wrong canonical tags.
	site: process.env.SITE_URL ?? 'https://flawless-react.in.drlario.org',
	// `gfm: true` is not the default for @astrojs/mdx (it pushes remark-gfm only when
	// the option is truthy), so without it every `| … |` table in the docs — the CLI
	// flag table first of all — is emitted as literal pipe characters in a paragraph.
	// `rehypeTableWrap` then gives those tables the scroll container they need on a phone.
	integrations: [mdx({ gfm: true, rehypePlugins: [rehypeTableWrap] }), sitemap()],
	markdown: {
		shikiConfig: {
			theme: 'github-dark',
			langs: ['bash', 'sh', 'shell', 'typescript', 'ts', 'tsx', 'json', 'yaml'],
			wrap: true,
		},
	},
});
