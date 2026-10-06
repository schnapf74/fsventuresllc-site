#!/usr/bin/env node
// Single source of truth for the markup every marketing page must share
// (factory "Marketing footer standard", 2026-09-30; same pattern as Sprinklerly sp-006).
//
// The marketing site is hand-written static HTML with no build step (Render serves it
// as-is), so a runtime include is not an option without hiding the shared markup from
// crawlers and no-JS visitors. Instead, each shared partial lives in scripts/marketing/
// and is stamped into every page between a pair of markers:
//
//   header.html  <!-- site-header:start --> ... <!-- site-header:end -->
//   footer.html  <!-- site-footer:start --> ... <!-- site-footer:end -->
//
// Both partials link with root-relative URLs (/products.html, not products.html) so they
// also work on public/404.html, which Render serves at whatever missing path was requested
// (cs-polish). A <base href> cannot fix that: the site's CSP sets base-uri 'none'.
//
//   node scripts/marketing/sync-partials.mjs          rewrite every page from the partials
//   node scripts/marketing/sync-partials.mjs --check  exit 1 if any page is missing a marker
//                                                     pair or has drifted (runs in CI)
//
// To change the header or footer: edit header.html / footer.html, run the sync, commit both.
// To add a page: start from scripts/marketing/page-template.html (it already carries the
// markers), or put the marker pair where the footer goes, then run the sync.
//
// The pages directory is public/ (Render's publish path, cs-publish-scope), so scripts/,
// .github/ and README.md stay out of the live site.
// Every .html file under the pages directory (recursively, so blog/<slug>/index.html is
// covered) and every URL in sitemap.xml is checked. MARKETING_DIR overrides the pages
// directory (used by the tests).

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const marketingDir = process.env.MARKETING_DIR
  ? resolve(process.env.MARKETING_DIR)
  : join(here, '..', '..', 'public');
const check = process.argv.includes('--check');

// Directories under the pages dir that never hold pages.
const SKIP_DIRS = new Set(['assets', 'scripts', 'node_modules']);

// indent: whitespace before the end marker, matching where the block sits in the page.
const PARTIALS = [
  { name: 'header', file: 'header.html', indent: '' },
  { name: 'footer', file: 'footer.html', indent: '' },
].map((p) => {
  const start = `<!-- site-${p.name}:start -->`;
  const end = `<!-- site-${p.name}:end -->`;
  const body = readFileSync(join(here, p.file), 'utf8').replace(/\s+$/, '');
  return { ...p, start, end, block: `${start}\n${body}\n${p.indent}${end}` };
});

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (name.endsWith('.html')) {
      out.add(relative(marketingDir, full).split(sep).join('/'));
    }
  }
  return out;
}

const pages = walk(marketingDir, new Set());
const sitemapPath = join(marketingDir, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  for (const [, loc] of readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = new URL(loc).pathname.replace(/^\//, '');
    pages.add(path === '' || path.endsWith('/') ? `${path}index.html` : path);
  }
}

const problems = [];
let changed = 0;
for (const page of [...pages].sort()) {
  const file = join(marketingDir, page);
  if (!existsSync(file)) {
    problems.push(`${page}: listed in sitemap.xml but not found on disk`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  let next = html;
  for (const p of PARTIALS) {
    const s = next.indexOf(p.start);
    const e = next.indexOf(p.end);
    if (s === -1 || e === -1 || e < s || next.indexOf(p.start, s + 1) !== -1) {
      problems.push(`${page}: needs exactly one ${p.start} ... ${p.end} pair`);
      continue;
    }
    const outside = next.slice(0, s) + next.slice(e + p.end.length);
    if (new RegExp(`<${p.name}\\b`, 'i').test(outside)) {
      problems.push(`${page}: has a <${p.name}> outside the ${p.start} markers`);
      continue;
    }
    const replaced = next.slice(0, s) + p.block + next.slice(e + p.end.length);
    if (replaced !== next && check) {
      problems.push(`${page}: ${p.name} differs from scripts/marketing/${p.file}`);
    }
    next = replaced;
  }
  if (!check && next !== html) {
    writeFileSync(file, next);
    changed++;
    console.log(`updated ${page}`);
  }
}

const names = PARTIALS.map((p) => p.name).join(' + ');
if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  console.error(
    check
      ? `Shared-partial check failed. Run: node scripts/marketing/sync-partials.mjs`
      : 'Partial sync incomplete (pages above were left partially updated or untouched).',
  );
  process.exit(1);
}
console.log(
  check
    ? `${names} OK on ${pages.size} pages`
    : `${names} synced (${changed} changed, ${pages.size} pages)`,
);
