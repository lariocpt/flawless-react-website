#!/usr/bin/env node
// Check every flawless-react example on this site against the real CLI.
//
// The site's code blocks and its CLI reference table are hand-maintained copies
// of the tool's docs, with no generation step — exactly the thing that rots.
// It had rotted: the "Every flag flawless-react accepts" table on /docs/cli was
// missing --roots, --exclude and --no-default-excludes for a whole release, and
// /docs/index promised per-component a11y reports the tool has never written.
//
// flawless-react's own repo lints its prose by importing parseArgs. This is a
// SEPARATE repo and cannot. What it can do is run the binary:
//   flawless-react --check '<lines>'   parses without running (no file opened,
//                                      nothing spawned)
//   flawless-react --flags             prints the flag inventory, one per line
// so an example naming ./src/Dashboard.tsx checks clean on a machine that has
// no such file.
//
// Usage: bun scripts/lint-examples.mjs [path-to-flawless-react]
// Exits 1 with the offending line, or the missing flag, if anything is stale.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const BIN = process.argv[2] ?? process.env.FLAWLESS_BIN ?? "flawless-react";
const ROOTS = ["src/pages", "src/components"];
const CLI_PAGE = "src/pages/docs/cli.mdx";

/** Below these the extractor is broken, not the docs. */
const MIN_INVOCATIONS = 15;
const MIN_TABLE_FLAGS = 20;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".mdx") || p.endsWith(".astro")) out.push(p);
  }
  return out;
}

// Strip an unquoted `#` comment and track whether the line leaves quotes or
// brackets open, so a `\`-continued invocation is joined with its continuation
// rather than checked as a fragment.
function scanLine(line, open) {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (open.q) {
      out += c;
      if (open.q === '"' && c === "\\" && i + 1 < line.length) out += line[++i];
      else if (c === open.q) open.q = null;
      continue;
    }
    if (c === '"' || c === "'") {
      open.q = c;
      out += c;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") open.depth++;
    if (c === ")" || c === "}" || c === "]") open.depth--;
    if (c === "#" && open.depth === 0) break;
    out += c;
  }
  return out;
}

const SHELL_LANGS = new Set(["bash", "sh", "shell", "console", "text"]);

function isSynopsis(line) {
  return /<[A-Za-z][\w.|-]*>/.test(line) || /\[options\]/.test(line) || /\s\([^)]*\)\s*$/.test(line);
}

const examples = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/```([a-z]*)\n([\s\S]*?)```/g)) {
      if (!SHELL_LANGS.has(m[1])) continue;
      const body = m[2];
      if (body.includes("<<")) continue; // heredoc payload, not a command
      const open = { q: null, depth: 0 };
      let buf = "";
      for (const raw of body.replace(/\s*\\\n\s*/g, " ").split("\n")) {
        const trimmed = raw.trim();
        if (!buf && (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("$"))) continue;
        buf += (buf ? " " : "") + scanLine(raw, open).trim();
        if (open.q || open.depth > 0) continue;
        const line = buf.trim();
        buf = "";
        // A synopsis is documentation shape, not a command:
        //   flawless-react <entry-or-glob> [options]
        //   flawless-react                       (interactive menu)
        // Angle-bracket placeholders, a bare [options], and a trailing
        // parenthetical annotation are all unambiguous — none appears in a real
        // invocation of this CLI.
        if (line && !isSynopsis(line)) examples.push({ file, line });
      }
    }
  }
}

if (examples.length === 0) {
  console.error("lint-examples: found no code blocks — the extractor is broken, not the docs");
  process.exit(1);
}

function bin(args) {
  const r = spawnSync(BIN, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error) {
    console.error(`lint-examples: cannot run ${BIN}: ${r.error.message}`);
    process.exit(1);
  }
  return r;
}

// --- 1. every documented invocation parses --------------------------------
//
// One call with every line, not one per line: --check reports how many
// invocations it actually examined, and the count is the only thing standing
// between a broken extractor and a green build that checked nothing.
const checked = bin(["--check", examples.map((e) => e.line).join("\n")]);
process.stdout.write(checked.stdout);
if (checked.status !== 0) {
  process.stderr.write(checked.stderr);
  console.error(`lint-examples: a documented example does not parse (${examples.length} lines fed)`);
  process.exit(1);
}
const n = Number(/ok: (\d+)/.exec(checked.stdout)?.[1] ?? 0);
if (n < MIN_INVOCATIONS) {
  console.error(
    `lint-examples: only ${n} invocation(s) checked, expected at least ${MIN_INVOCATIONS} — the extractor is broken, not the docs`,
  );
  process.exit(1);
}

// --- 2. the CLI reference lists every flag, and invents none ---------------
//
// --check cannot see this: a flag simply ABSENT from the table appears in no
// example, so nothing fails. That is how three real flags went undocumented.
const real = new Set(
  bin(["--flags"])
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
);
// `--flags` deliberately prints only the flags that change what a RUN does, so the
// two meta-verbs that answer about the CLI itself are not in it — while this site's
// table is "every flag flawless-react accepts", and documents them. If a third
// meta-flag ever appears, the check below fails as "invented", which is the loud
// direction: come add it here.
for (const meta of ["--flags", "--check"]) real.add(meta);
if (real.size === 0) {
  console.error("lint-examples: --flags printed nothing — is the binary older than the flag?");
  process.exit(1);
}

const table = new Set();
for (const line of readFileSync(CLI_PAGE, "utf8").split("\n")) {
  if (!line.startsWith("| `-")) continue;
  const cell = line.slice(0, line.indexOf("|", 1) + 1);
  for (const f of cell.match(/--[a-z][a-z-]*/g) ?? []) table.add(f);
}
if (table.size < MIN_TABLE_FLAGS) {
  console.error(
    `lint-examples: found only ${table.size} flags in ${CLI_PAGE}'s table — the table parser is broken`,
  );
  process.exit(1);
}

const undocumented = [...real].filter((f) => !table.has(f));
const invented = [...table].filter((f) => !real.has(f));
if (undocumented.length || invented.length) {
  if (undocumented.length) console.error(`FAIL ${CLI_PAGE}: real flags missing from the table: ${undocumented.join(", ")}`);
  if (invented.length) console.error(`FAIL ${CLI_PAGE}: table documents flags the CLI rejects: ${invented.join(", ")}`);
  process.exit(1);
}

console.log(`lint-examples: ${n} invocation(s) parse, ${table.size} documented flag(s) all real`);
