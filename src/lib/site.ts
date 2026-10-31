// Build-mode switches for the two places this site is deployed.
//
// LAN is the DEFAULT, deliberately: an unadorned `bun run build` is what the Jenkins job
// runs, and its Gate stage fails the build if `github.com` appears anywhere in dist/ and
// requires the canonical to be the LAN host. So everything public-only has to be opt-in
// rather than opt-out. Set PUBLIC_SITE=1 to build the public variant, which is what
// .github/workflows/pages.yml does.
//
// Read through process.env as well as import.meta.env: every consumer here runs at build
// time (static output), and only import.meta.env is inlined by Vite — a var set purely in
// the shell reaches us via process.env.
function envVar(name: string): string | undefined {
	const fromVite = (import.meta.env as Record<string, unknown>)[name];
	if (typeof fromVite === 'string') return fromVite;
	return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

export const isPublic = envVar('PUBLIC_SITE') === '1';

/**
 * Astro's configured base ("/" when unset). It is NOT guaranteed to end with a slash —
 * with `base: '/flawless-react-website'` it has none — so normalise before joining rather
 * than concatenating straight onto it.
 */
export const base: string = import.meta.env.BASE_URL ?? '/';

/**
 * Make a root-relative internal link base-aware.
 *
 * A GitHub Pages *project* site is served from a subpath, and Astro does not rewrite hrefs
 * written in markup — `base` only changes where pages are emitted. So a literal
 * href="/docs/" silently 404s under a base, and nothing at build time catches it. Route
 * every internal link through here.
 *
 * Anything not starting with a single "/" (external URLs, "//cdn…", "#anchor", relative
 * paths) is returned untouched.
 */
export function href(path: string): string {
	if (!path.startsWith('/') || path.startsWith('//')) return path;
	const prefix = base.replace(/\/+$/, '');
	if (!prefix) return path;
	// Idempotent: the MDX rehype pass also prefixes links, so a value that has already been
	// based must not be based twice.
	if (path === prefix || path.startsWith(`${prefix}/`)) return path;
	return `${prefix}${path}`;
}

/**
 * Strip the base off a pathname so it can be compared against literal route prefixes.
 * `Astro.url.pathname` INCLUDES the base, so nav active-state checks like
 * `pathname.startsWith('/docs')` stop matching under a subpath deploy.
 */
export function routePath(pathname: string): string {
	const prefix = base.replace(/\/+$/, '');
	if (prefix && pathname.startsWith(prefix)) {
		return pathname.slice(prefix.length) || '/';
	}
	return pathname;
}

/**
 * The binary installer shown on the site. The LAN one-liner resolves the artifact through
 * apps.in.drlario.org/index.tsv; the public one reads the installer out of the repo and
 * falls out at the GitHub release. Both verify the published sha256 before installing, and
 * neither needs a clone on the target machine.
 */
export const INSTALL_COMMAND = isPublic
	? 'curl -fsSL https://raw.githubusercontent.com/lariocpt/flawless-react/main/install.sh | bash'
	: 'curl -fsSL https://apps.in.drlario.org/install.sh | bash -s -- flawless-react';

/**
 * The npm channel, per plane. Both carry the SOURCE package (all tasks work, needs Bun);
 * they differ only in which registry the name resolves in. The scoped name is correct on
 * both — the unscoped `flawless-react` name was renamed away in 0.3.0.
 */
export const NPM_INSTALL_COMMAND = isPublic
	? 'bun add -g @lariocpt/flawless-react'
	: 'bun add -g @lariocpt/flawless-react --registry https://npm.in.drlario.org';

/** Public-mode only — the LAN Gate fails the build on any github.com string in dist/. */
export const REPO_URL = 'https://github.com/lariocpt/flawless-react';

/** crust's own home, per plane: the public Pages site vs the LAN vhost. */
export const CRUST_URL = isPublic ? 'https://lariocpt.github.io/crust-website/' : 'https://crust.in.drlario.org';
