// Tests for sync-partials.mjs (marketing footer standard). Run: node --test scripts/marketing/sync-partials.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'sync-partials.mjs');
const realPages = join(here, '..', '..');
const footer = readFileSync(join(here, 'footer.html'), 'utf8').trimEnd();

function run(dir, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, MARKETING_DIR: dir },
    encoding: 'utf8',
  });
}

const page = (footerMarkers = true) =>
  [
    '<!doctype html><html><head><meta charset="utf-8" /></head><body>',
    footerMarkers ? '<!-- site-footer:start -->\n<!-- site-footer:end -->' : '<footer>old</footer>',
    '</body></html>',
  ].join('\n');

function tmp(pages) {
  const dir = mkdtempSync(join(tmpdir(), 'mkt-'));
  for (const [name, html] of Object.entries(pages)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), html);
  }
  return dir;
}

test('the real marketing site is in sync (same check CI runs)', () => {
  const r = run(realPages, '--check');
  assert.equal(r.status, 0, r.stderr);
});

test('the new-page template carries the footer markers', () => {
  const tpl = readFileSync(join(here, 'page-template.html'), 'utf8');
  const dir = tmp({ 'new.html': tpl });
  assert.equal(run(dir).status, 0);
  assert.ok(readFileSync(join(dir, 'new.html'), 'utf8').includes(footer));
});

test('sync stamps the footer into nested pages, then --check passes', () => {
  const dir = tmp({ 'a.html': page(), 'blog/post/index.html': page() });
  assert.equal(run(dir, '--check').status, 1);
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['a.html', 'blog/post/index.html']) {
    assert.ok(readFileSync(join(dir, f), 'utf8').includes(footer), f);
  }
  assert.equal(run(dir, '--check').status, 0);
});

test('--check fails for a new page with a hand-written footer and no markers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mkt-'));
  cpSync(realPages, dir, { recursive: true, filter: (s) => !/node_modules|\.git/.test(s) });
  mkdirSync(join(dir, 'blog', 'new-post'), { recursive: true });
  writeFileSync(join(dir, 'blog', 'new-post', 'index.html'), page(false));
  const r = run(dir, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /blog\/new-post\/index\.html: needs exactly one <!-- site-footer:start -->/);
});

test('--check fails when the footer inside a page was hand-edited', () => {
  const dir = tmp({ 'a.html': page() });
  run(dir);
  const f = join(dir, 'a.html');
  writeFileSync(f, readFileSync(f, 'utf8').replace('</footer>', '<a href="/x">x</a></footer>'));
  const r = run(dir, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a\.html: footer differs from scripts\/marketing\/footer\.html/);
});

test('--check fails when a second <footer> sits outside the markers', () => {
  const html = page().replace('</body>', '<footer>stray</footer>\n</body>');
  const r = run(tmp({ 'a.html': html }), '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /has a <footer> outside/);
});

test('--check fails for a sitemap URL with no page on disk', () => {
  const dir = tmp({
    'index.html': page(),
    'sitemap.xml': '<urlset><url><loc>https://example.com/blog/missing/</loc></url></urlset>',
  });
  run(dir);
  const r = run(dir, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /blog\/missing\/index\.html: listed in sitemap\.xml but not found/);
});
