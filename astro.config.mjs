// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

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
	integrations: [mdx()],
	markdown: {
		shikiConfig: {
			theme: 'github-dark',
			langs: ['bash', 'sh', 'shell', 'typescript', 'ts', 'tsx', 'json', 'yaml'],
			wrap: true,
		},
	},
});
