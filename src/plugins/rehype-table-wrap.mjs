/**
 * rehype plugin: wrap every rendered `<table>` in `<div class="table-wrap">`.
 *
 * A Markdown table carries no markup of its own, and a table's used width is never
 * less than the sum of its columns' min-content widths — a `Tool` column full of
 * 23-character tool names plus a prose column easily exceeds a phone. Without a
 * scroll container the only two outcomes are both ones this site measured: the
 * page grows wider than the viewport, or `overflow-wrap: anywhere` shrinks the
 * identifier column until it renders as `fla`/`wle`/`ss_r`. A wrapper div keeps the
 * table's semantics, which `display: block` on the table itself would not.
 *
 * Written against the plain node shape instead of `unist-util-visit` on purpose:
 * that package is a transitive dependency here, not one this site declares.
 */
const CLASS = 'table-wrap';

function isTable(node) {
	// MDX hands over `mdxJsxFlowElement` nodes for raw HTML tables written as JSX;
	// Markdown pipe tables are plain `element` nodes by the time rehype runs.
	return (
		(node?.type === 'element' && node.tagName === 'table') ||
		(node?.type === 'mdxJsxFlowElement' && node.name === 'table')
	);
}

function wrapTables(node) {
	if (!Array.isArray(node?.children)) return;
	const children = [];
	for (const child of node.children) {
		if (isTable(child)) {
			// The wrapper's own child list is not walked, so this cannot wrap twice;
			// a table nested in a cell is rare enough to leave inside the outer one.
			//
			// `tabindex` because the wrapper is scrollable, and a scrollable region a
			// keyboard user cannot focus cannot be scrolled by anyone without a mouse —
			// axe flags exactly this as scrollable-region-focusable / WCAG 2.1.1.
			children.push({
				type: 'element',
				tagName: 'div',
				properties: { className: [CLASS], tabIndex: 0 },
				children: [child],
			});
			continue;
		}
		wrapTables(child);
		children.push(child);
	}
	node.children = children;
}

export function rehypeTableWrap() {
	// Start at the tree itself: on an MDX page a table is usually a direct child of
	// the root, so a walk that began with the root's children would miss every one.
	return (tree) => {
		wrapTables(tree);
	};
}

export default rehypeTableWrap;
