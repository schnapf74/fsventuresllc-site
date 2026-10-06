# fsventuresllc-site

The company website for F&S VENTURES LLC (fsventuresllc.com) — the page D&B, Apple and
Google Play look at when they verify the entity is a real operating company.

Plain static HTML/CSS. No build step, no framework, no third-party scripts, no analytics.
Deployed as a Render static site. The pages live in `public/`, which is Render's publish
directory, so `scripts/`, `.github/` and this README are never served (cs-publish-scope).

Source of truth for content decisions: `state/briefs/company-site.md` in the
`schnapf74/saas-factory` control repo.

## Shared footer

Every page renders the same footer. It lives once, in `scripts/marketing/footer.html`, and
`node scripts/marketing/sync-partials.mjs` stamps it into every page between
`<!-- site-footer:start -->` / `<!-- site-footer:end -->` markers. To change the footer, edit the
partial and run the sync. To add a page, copy `scripts/marketing/page-template.html` into `public/`,
add the URL to `public/sitemap.xml`, and run the sync. The `Marketing footer` CI workflow fails if any page
drifts or lacks the markers.
