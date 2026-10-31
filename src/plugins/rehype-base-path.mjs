/**
 * rehype plugin: prefix every root-relative internal link with the configured base path.
 *
 * Astro's `base` changes where pages are EMITTED and what `Astro.url.pathname` reports. It
 * does not rewrite hrefs written in markup, so a Markdown link `[X](/docs/quickstart/)`
 * keeps pointing at the domain root — under a GitHub Pages project site (`/flawless-react-website`)
 * that is a 404, and nothing at build time catches it. The site has 99 such links in its
 * .mdx prose; rewriting them by hand would need re-rewriting on every new page, so they are
 * prefixed here instead. No-op when no base is configured, which is every LAN build.
 *
 * Two node shapes carry a link, and missing the second is the classic miss: a Markdown link
 * or raw HTML becomes an `element` with `properties`, while a JSX component in MDX
 * (`<RecipeCard href="/docs/…" />`) is an `mdxJsx*Element` whose `attributes` is an ARRAY.
 *
 * Written against the plain node shape instead of `unist-util-visit` on purpose: that
 * package is a transitive dependency here, not one this site declares.
 */
const PREFIX = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');
const ATTRS = ['href', 'src'];

function internal(value) {
	// A single leading slash only: "//cdn.example.com" is protocol-relative, i.e. absolute.
	return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

function based(value) {
	// Idempotent, because `href()` in src/lib/site.ts may already have based this same
	// string, and a double prefix would be a silent 404 of its own.
	return !PREFIX || value === PREFIX || value.startsWith(`${PREFIX}/`);
}

function fix(value) {
	return internal(value) && !based(value) ? `${PREFIX}${value}` : value;
}

function walk(node) {
	if (!node || typeof node !== 'object') return;

	if (node.type === 'element' && node.properties) {
		for (const attr of ATTRS) {
			if (internal(node.properties[attr])) node.properties[attr] = fix(node.properties[attr]);
		}
	}

	if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
		for (const attr of node.attributes ?? []) {
			if (attr.type === 'mdxJsxAttribute' && ATTRS.includes(attr.name)) {
				attr.value = fix(attr.value);
			}
		}
	}

	for (const child of node.children ?? []) walk(child);
}

export function rehypeBasePath() {
	return (tree) => {
		if (!PREFIX) return;
		walk(tree);
	};
}

export default rehypeBasePath;
