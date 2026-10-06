# fsventuresllc-site

The company website for F&S VENTURES LLC (fsventuresllc.com) — the page D&B, Apple and
Google Play look at when they verify the entity is a real operating company.

Plain static HTML/CSS. No build step, no framework, no third-party scripts, no analytics.
Deployed as a Render static site. The pages live in `public/`, which is Render's publish
directory, so `scripts/`, `.github/` and this README are never served (cs-publish-scope).

Source of truth for content decisions: `state/briefs/company-site.md` in the
`schnapf74/saas-factory` control repo.

## Shared header and footer

Every page renders the same header and footer. Each lives once, in `scripts/marketing/header.html`
and `scripts/marketing/footer.html`, and `node scripts/marketing/sync-partials.mjs` stamps them into
every page between `<!-- site-header:start/end -->` and `<!-- site-footer:start/end -->` markers.
Their links are root-relative (`/products.html`) because `public/404.html` is served at any missing
path. To change either, edit the partial and run the sync. To add a page, copy `scripts/marketing/page-template.html` into `public/`,
add the URL to `public/sitemap.xml`, and run the sync. The `Marketing footer` CI workflow fails if any page
drifts or lacks the markers.
