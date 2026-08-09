# flawless-react-website

The documentation site for [flawless-react](../flawless-react), served on the LAN at
**https://flawless-react.in.drlario.org**.

Astro 6 + MDX, built with bun. The content is a port of flawless-react's own README and
`docs/` — those files stay the source of truth, and this site is where they are readable.

## Develop

```bash
bun install
bun run dev          # http://localhost:4321
bun run build        # -> dist/
```

`astro.config.mjs` reads `site` from `SITE_URL`, defaulting to the LAN vhost. It must never be
empty: `src/layouts/Layout.astro` builds the canonical tag with
`new URL(Astro.url.pathname, Astro.site)`, which throws on an undefined base — so a bad value
fails the build instead of quietly emitting wrong canonical URLs.

## Deploy

Jenkins job `flawless-react-website`, Pipeline-from-SCM against `main`. It builds in an
`oven/bun:1` container and calls `publish/bin/site-deploy`, which rsyncs into
`/srv/sites/flawless-react-website/releases/<version>` and swaps the `current` symlink
atomically. Caddy resolves that symlink per request, so a deploy needs no reload.

## Two things that will bite

**`bun.lock` is the only lockfile.** Preflight fails if a `package-lock.json` appears.
crust-website carried both for a while and they silently pinned different astro versions with
nothing keeping them in step.

**Nothing public may appear in the output.** flawless-react is a private project, and the
Gate stage fails the build if `github.com` shows up anywhere in `dist/`. If you add a link,
keep it internal.

## Adding a docs page

1. Write `src/pages/docs/<slug>.mdx` with the frontmatter the other pages use
   (`layout`, `title`, `description`).
2. Add it to the relevant section in `src/components/Sidebar.astro` — the sidebar is a hand-
   maintained list, not generated from the filesystem.
