# Fix plan for SEO-AUDIT.md (evelynmichaelides.com)

**Status:** Decisions received 2026-10-15 (below). Implementation in progress on branches `seo/phase-1-head` → `seo/phase-2-hosting` → `seo/phase-3-static-render` → `seo/phase-4-images`. Each is stacked on the previous one, and nothing is pushed until approved.
**Prepared:** 2026-10-15, against `main` @ `7e41de4` ("Update About the Artist copy"), which matches what is live.

## Decisions (answers to §7)

| # | Decision |
|---|---|
| 1 | Cloudflare Pages project `gilanicollectiontest`, Git integration, production branch `main`, no build command, output = repo root, build image v3, preview deployments for all branches, no Functions. Ned owns the account. **A build step is approved.** |
| 2 | **Option A** (dependency-free Node build script). |
| 3 | **`VisualArtwork`**. No prices for now. |
| 4 | Delegated to me. **Policy: discoverable and citable everywhere; artwork not offered for model training where that can be separated from search.** `robots.txt` explicitly allows search engines and AI answer/search agents, and disallows training-only crawlers (GPTBot, ClaudeBot, CCBot, Amazonbot, Bytespider, Applebot-Extended, meta-externalagent). This matches the existing Cloudflare edge block. **`Google-Extended` stays allowed**, because Google's token covers Gemini *grounding* as well as training, so opting out would also remove the site from Gemini answers. Flip it in one line if training opt-out matters more. |
| 5 | Use `original-gemini-hero.png` as the hero encoding source. Ned wants it committed and deployed. (It needs to come from Ned's machine, since it isn't in Git.) |
| 6 | Delegated to me. **`_headers` file in the repo** (versioned, testable on preview deployments). **Staged HSTS** (`max-age=300` → 2 years + preload after a clean week). |
| 7 | Slug fixed in Studio by Evelyn (`the-tale-of-two-siblings`). |
| 8 | `/works/<slug>` approved. **No** homepage card links and **no** lightbox "view details" link for now. Gallery cards become real links that still open the lightbox on click (§3). |
| 9 | Removed works **404**. No archive. |
| 10 | Real 404 page: yes. `www` → apex redirect: yes (dashboard Redirect Rule, done by Ned). |

## Implementation status (2026-10-16)

All four phases are built and verified locally. They are committed on stacked branches and **not pushed**.

| Branch | Commit | Contents |
|---|---|---|
| `seo/phase-1-head` | `9f0b6f9` | Canonical `/gallery`, hero `og:image`, Twitter cards, preconnect, Person/WebSite JSON-LD |
| `seo/phase-2-hosting` | `60f22a4` | `404.html` (real 404s), `_headers` (XFO, HSTS 300 s, CSP Report-Only), robots.txt crawler policy |
| `seo/phase-3-static-render` | `2fcd864` | `scripts/build.mjs`, `/works/<slug>` pages, generated sitemap + JSON-LD, `dist/` allowlist, `DEPLOY.md` |
| `seo/phase-4-images` | `769e9a7` | Hero `<picture>` (AVIF/WebP), sized variants for portrait/tools/logo, width/height |

**Verified locally**, using a Pages-like server against live Sanity data:
- **Raw HTML:** 3/3 featured and 16/16 gallery cards, no "coming soon".
- **Sitemap and routing:** all 18 sitemap URLs return 200 with `lastmod`. `sanity/`, `*.md` and dotfiles return 404, and unknown URLs return a real 404.
- **Structured data:** 19 pages pass a schema.org vocabulary check with 0 errors.
- **CSP:** zero reports across home, gallery, lightbox, work page, form submit and 404.
- **Behaviour:** lightbox click, arrows, Escape, Enter/Space and focus return are unchanged. With JS off, gallery cards navigate to work pages.
- **Visual:** home and gallery are pixel-identical to the live site after Phase 3. After Phase 4, the gallery is identical and the homepage differs by ≤61 px of photo compression noise.
- **Images:** homepage 963 KB → 159–293 KB. Lighthouse mobile perf 70 → 88, LCP 7.4 s → 3.1 s, CLS 0.
- **Failure drills:** a wrong dataset, zero items or Sanity unreachable all fail the build, so the previous deploy stays live. `ALLOW_EMPTY=1` shows the "coming soon" copy.

**Also found during implementation:**
- The audit's image-sitemap namespace is wrong. Google's is `http://www.google.com/schemas/sitemap-image/1.1`, which is what the build uses.
- Sanity CORS allows only the live domains, `gilanicollectiontest.pages.dev` and `localhost:3333`. Branch previews and Live Server on `:5501` currently get an empty gallery. After Phase 3 that no longer matters, because content is in the HTML.
- The build reads Sanity's live API, not the CDN, so a webhook-triggered rebuild never picks up a stale pre-publish version.
- `original-gemini-hero.png` hasn't been provided yet. Hero variants were encoded from `gemini-hero.jpg` (visually indistinguishable at 100%). Regenerate from the PNG when it's available.

**Rollout order for Phase 3.** Pages build settings are shared by production and preview, so:
1. Merge Phases 1–2 to `main` while there is still no build step.
2. Change the build settings.
3. Redeploy the Phase 3 preview and verify it.
4. Merge.

Between steps 2 and 4, a push to `main` would fail to build, and production would simply keep the last good deploy.

---

## 1. Audit verification

### How I checked
- Read every file in the repo (`index.html`, `gallery.html`, `gallery.js`, `selected-works.js`, `script.js`, `sanityClient.js`, `styles.css`, `robots.txt`, `sitemap.xml`, `sanity/` Studio config and schema).
- Fetched the live site and its headers, compared live HTML with the repo, and probed URL behaviour and crawler user agents.
- Queried Sanity read-only through the public API (no token): `g2n6h8e3` / `gallery`.

### What the audit gets right
All file paths, line numbers, the GROQ queries, file sizes and the empty-grid / "coming soon" behaviour are accurate. Specifically confirmed:

| Audit claim | Verified |
|---|---|
| `index.html:79-80`, `gallery.html:69-70` empty grids | Yes |
| `gallery.js:152-164` query fetches `slug` but never uses it | Yes |
| `gallery.js:166-230` cards are `<article role="button">` opening a lightbox, no `<a href>` | Yes |
| Live raw HTML contains only the "coming soon" copy, no artwork | Yes |
| No JSON-LD anywhere | Yes |
| Homepage `og:image` is `gilanilogo.png` (33,623 B); gallery uses `gemini-hero.jpg` | Yes |
| No Twitter Card tags, no preconnect, no `apple-touch-icon` / manifest | Yes |
| Image sizes: hero 334,638 B, portrait 148,985 B, tools 320,249 B, logo jpg 158,742 B | Yes |
| Live headers: no CSP / HSTS / X-Frame-Options; `access-control-allow-origin: *` on HTML | Yes |
| `original-gemini-hero.png` is untracked, not in the GitHub repo | Yes |

Sanity data today: **16 published `galleryItem`s, 3 featured, 0 drafts visible, all 16 slugs present, unique and URL-safe.** None have `order` set, so ordering is purely by `_updatedAt`. The dataset is publicly readable, so a build needs no token.

### What the audit gets wrong, or misses

**A. The canonical gallery URL is `/gallery`, not `/gallery.html` (audit misses this; it matters for every URL decision).**
Live, `/gallery.html` returns `308 → /gallery` and `/index.html` returns `308 → /`. Yet `gallery.html:8` canonical, `gallery.html:13` `og:url` and `sitemap.xml` all point at `/gallery.html`, a redirecting URL. Search engines treat a canonical that redirects as a conflicting signal. The audit's own acceptance test (`curl -s …/gallery.html | grep …`) would always fail, because a 308 has no body. All checks in this plan use `/gallery` or `curl -L`.

**B. Unknown URLs return 200 with the homepage (soft 404s).**
`/definitely-not-a-page-xyz`, `/works/kolona` and `/_headers` all return `200` with the homepage HTML. There is no `404.html`, so the host falls back to `index.html`. Every typo URL is a duplicate of the homepage, and once per-artwork pages exist, a deleted artwork would silently become a homepage duplicate instead of a 404.

**C. The whole repo root is public, including the Sanity Studio source.**
`/sanity/package.json`, `/sanity/package-lock.json` (665 KB), `/sanity/sanity.config.js`, `/sanity/schemaTypes/galleryItem.js`, `/.gitattributes` and `/.vscode/settings.json` all return `200`. Nothing secret is in them, but it confirms there's no output-directory allowlist. **Consequence for right now:** if `SEO-AUDIT.md` or this `PLAN.md` is committed and pushed before Phase 3, it will be publicly served at `evelynmichaelides.com/PLAN.md`. Keep both out of the repo, or add them only after Phase 3 moves deploys to a `dist/` allowlist.

**D. Finding 8's premise is wrong: AI training crawlers are already blocked at Cloudflare.**
`robots.txt` says allow-all, but the Cloudflare edge returns `403 "Your request was blocked."` to GPTBot, ClaudeBot, CCBot, Amazonbot and Bytespider. It returns `200` to Googlebot, Bingbot, Applebot, OAI-SearchBot, ChatGPT-User, PerplexityBot and Claude-SearchBot, and to every social-preview scraper (facebookexternalhit, LinkedInBot, Twitterbot, Slackbot, Discordbot, WhatsApp). This pattern matches Cloudflare's zone-level AI-bot blocking (training crawlers blocked, search and user-triggered agents allowed). So the real policy is set in the Cloudflare dashboard, and `robots.txt` contradicts it. Caveats: I tested with spoofed user agents from a non-verified IP, so confirm in the dashboard. `Google-Extended` is a robots.txt token, not a crawler user agent, so only `robots.txt` can control it, and it is currently allowed.
This also corrects Finding 1, point 3. Training crawlers see a 403, not the placeholder, so static rendering won't help them unless the block is lifted. AI search agents (OAI-SearchBot, PerplexityBot, Claude-SearchBot) are allowed and do mostly skip JavaScript, so for them Finding 1 stands.

**E. The `www` host serves a duplicate instead of redirecting.**
`https://www.evelynmichaelides.com/` returns `200` with the full page. Its canonical tag points at the apex, which limits the damage, but it should be a `301` to the apex.

**F. Finding 6: `tools.jpeg` is very likely downloaded once, not twice.**
Both `<img>` tags use the identical URL, and browsers de-duplicate identical image URLs within a document. The CSS (`styles.css:860-862`, `1112-1118`) toggles the containers with `display:none`, and images inside hidden containers are still fetched, but only once per URL. The real issues are the missing `width`/`height` attributes and the duplicate DOM. I'll still verify this in DevTools at 375 px and 1280 px, as the audit asks.

**G. Finding 6: the hero JPEG was made larger on purpose.**
Commit `2406def` (2026-09-10, "Use full-resolution source for hero background") replaced a 129 KB hero with the current 334 KB one. Before that, `9e5b050` tried size-aware hero loading and was reverted with the Sanity-editable hero (`d86bbea`). Sharpness was a deliberate choice, so the fix is responsive, modern-format variants at the same visual quality, not simply recompressing the file.

**H. Finding 7: `gallery.html` doesn't load Google Fonts at all.**
Manrope is used only by `.hero__title` (`styles.css:309`), which exists only on the homepage. Preconnect applies to `index.html` only, and nothing needs to change on the gallery page.

**I. Finding 3: the homepage cards are not "the same pattern".**
`selected-works.js:40-77` cards have no `role`, no click handler and no lightbox; they are static. They also don't request `dimensions`. Linking them to artwork pages would be a behaviour change, so it is listed as a question.

**J. `original-gemini-hero.png` is not deployed.**
Live `/original-gemini-hero.png` returns the homepage HTML fallback (see B), not a PNG. Consistent with it being untracked, and with deploys coming from Git rather than from your folder.

**K. Smaller things found along the way**
- **Slug typo:** "The Tale of Two Siblings" has slug `the-stale-of-two-siblings`. Once artwork URLs exist, slugs become permanent, so fix this in Studio **before** Phase 3 ships. I have read-only access and won't touch it.
- The gallery's "Updated …" line (`gallery.js:25-35, 65`) always shows **today's date**, because it uses `new Date()` at page load rather than any content date.
- Sanity originals run up to 4032 px / 3.4 MB. The site already requests resized versions (`?w=640|800|1600&auto=format`), which is good. Generated OG, JSON-LD and sitemap image URLs must use resized versions too, not raw asset URLs.
- The schema has no alt-text, medium, date or price fields. Alt text is currently the title. `image.hotspot` is enabled in Studio but unused by the site.
- Cloudflare injects email obfuscation and a hidden `nofollow` bot-trap link into the HTML. Both are zone-level features, which confirms you or Evelyn have a Cloudflare zone with dashboard access. A future CSP must allow the injected `/cdn-cgi/` script.

### Deployment mechanism: evidence so far
These all point to **Cloudflare Pages with Git integration, no build command and output directory = repo root**:
- Pretty-URL `308` redirects and the `index.html` fallback for unknown paths are Pages behaviours.
- Git-tracked files (`.gitattributes`, `.vscode/settings.json`) are served, while the untracked PNG is not.
- Live HTML matches `main` exactly.

There is no `.github/` folder, so no CI. This still needs confirming in the dashboard (Question 1). Nothing below assumes it until then.

---

## 2. Findings grouped by root cause

| Root cause | Findings | Notes |
|---|---|---|
| **R1. Content exists only at runtime in the browser.** There is no step where Sanity data becomes HTML. | 1, 3, 4, plus the per-artwork parts of 2 and 5 | One fix: render from Sanity at deploy time. |
| **R2. Page `<head>`s are hand-maintained and have drifted.** | 5 (homepage `og:image`, Twitter tags), 7, 10, the site-level part of 2, and new A (canonical / `og:url` pointing at a redirect) | Plain HTML edits. No build needed. |
| **R3. Hosting behaviour isn't defined in the repo.** It lives in Cloudflare defaults and the dashboard. | 8, 9, and new B (soft 404s), C (public repo files), D (edge AI block vs robots.txt), E (www) | Mostly needs dashboard confirmation first. |
| **R4. No image pipeline for local assets.** | 6 | Independent of everything else. |

**On the audit's dependency claim:**
- **1 and 3 share one fix: confirmed.** Generating cards and generating artwork pages are the same data and the same templating step.
- **4 depends on 1/3: confirmed.** The sitemap's value is the per-artwork URLs and `lastmod`, which come from the same build.
- **2 depends on 1/3: only partly.** The `Person` and `WebSite` entities are static facts and can ship now (Phase 1). The `ItemList` and per-artwork entities do depend on the build, and also on a decision (`VisualArtwork` vs `Product`, Question 3).
- **5 is split.** Homepage `og:image` and the Twitter tags ship now. Per-artwork OG tags come with the build.

---

## 3. Rendering architecture (Findings 1, 3, 4)

The goal: every page's HTML, as first served, contains the real artwork content. Each artwork gets a stable URL, and the sitemap is generated, not hand-written.

### Option A: Dependency-free Node build script (recommended)

**What it is.** `scripts/build.mjs` uses only Node built-ins (`fetch`, `fs`, `path`), with no npm packages and no `package.json` needed at the root. It:
1. Queries Sanity's public HTTP API, read-only with no token, using the same projection the site uses now, plus `_updatedAt` and image width/height from asset metadata.
2. Treats `index.html` and `gallery.html` as templates. It fills marker comments inside the existing empty grids (e.g. `<!-- build:gallery-grid -->`) with the same card markup `renderCard` produces today, so styling is unchanged.
3. Writes one page per artwork at `works/<slug>.html`. Pages serves that file at `/works/<slug>`, matching the site's existing extensionless `/gallery` style. The page reuses the site header, footer and existing card/lightbox CSS.
4. Generates `sitemap.xml` (all URLs, `lastmod`, image entries) and the per-artwork JSON-LD and OG tags.
5. Copies an **explicit allowlist** of public files into `dist/`, which fixes C: `sanity/`, dotfiles and Markdown stop being served.

**Client JS becomes enhancement only.**
- `gallery.js` attaches the lightbox to cards already in the page instead of building them. Each card is a real `<a href="/works/<slug>">`; the script intercepts plain clicks and Enter/Space to open the lightbox exactly as now. Without JS, and for crawlers, it's a normal link. Cmd/Ctrl/middle-click would open the artwork page, which is the only user-visible difference.
- **Runtime fallback:** if a grid arrives empty (for example when opening the source files with VS Code Live Server, which `.vscode/settings.json` shows is in use), the scripts fall back to today's runtime fetch. Local dev keeps working without running the build.

**Safety rules in the script.**
- All Sanity strings are HTML-escaped, and JSON-LD is escaped against `</script>`.
- The build fails, exiting non-zero, on: an API error after 3 retries, a missing or duplicate slug, or **zero items** unless `ALLOW_EMPTY=1` is set. A misconfigured project or dataset therefore can't publish an empty gallery.

| | |
|---|---|
| **Effort** | About 1–1.5 days to build, plus about 0.5 day to verify. |
| **Risk** | Low. The source HTML/CSS stay the same files; only marker comments are added and card markup is generated server-side. Zero dependencies to maintain. |
| **Deploy changes** | Pages build command: blank → `node scripts/build.mjs`. Output directory: `/` → `dist`. Env var `NODE_VERSION=22`, so `fetch` is guaranteed. Root directory unchanged. |
| **Content sync** | A Sanity GROQ webhook (filter `_type == "galleryItem"`, on create/update/delete) POSTs to a Cloudflare Pages **deploy hook**. Publish to live in about 1–2 minutes, versus a few seconds today via the Sanity CDN. The deploy-hook URL is a secret and lives only in Sanity's webhook settings, never in the repo. Optional safety net: a daily scheduled rebuild. Check the Sanity plan's webhook allowance. |
| **Build fails / Sanity down** | Pages keeps serving the last successful deployment, because failed builds never replace production. Visitors see the previous good catalogue, not an empty one. Code-only pushes made while Sanity is down will also fail, and just need a retry later. |
| **Rollback** | Instant: "Rollback" to the previous deployment in Pages, then reset build command and output directory. Source files are unchanged, so the old no-build setup works again immediately. |

### Option B: Framework migration (Astro static build)

**What it is.** Port both pages to Astro components, fetch Sanity at build time, and use Astro's sitemap integration and image pipeline. This would also cover Finding 6.

| | |
|---|---|
| **Effort** | About 3–5 days, including pixel-matching the current design and re-verifying everything. |
| **Risk** | Medium. Rewrites every page, adds npm dependencies and a lockfile to maintain, and changes the dev workflow (`npm run dev` replaces Live Server). Larger surface for visual regressions. |
| **Deploy changes** | Build command `npm run build`, output `dist`, `NODE_VERSION` set, plus an install step on every build. |
| **Content sync** | Same webhook → deploy hook as Option A. |
| **Build fails / Sanity down** | Same as A: the last good deploy stays live. There are more ways to fail, though, such as dependency install problems. |
| **Rollback** | Pages rollback works, but reverting the code is a large revert rather than a settings change. |

The upside is a proper template and component system, plus a built-in image pipeline. It's also the path to bring this site onto your Astro-based portfolio engine later, if you ever want that. That engine has its own motion and design system, though, so it would be a redesign, not an SEO fix.

### Option C: Edge rendering with Pages Functions (considered, not recommended)

A `functions/` handler fetches Sanity on each request (cached) and injects cards with `HTMLRewriter`. Pages deploys `functions/` without a build command, and content is always fresh with no webhook. However, every page view now depends on Sanity and Workers being up, unless the caching is engineered carefully. It also adds Workers free-tier request limits and needs `wrangler` for local testing. Effort is about 1.5–2 days. It trades the build-time failure mode, which is safe, for a request-time one, which is not.

### Rejected: committed JSON snapshot
The audit's weakest fallback, where someone commits a data file whenever Evelyn publishes. It goes stale by design and needs a code change per artwork.

### Recommendation: Option A
It fixes R1 completely with the smallest change. It adds no dependencies and keeps the exact HTML/CSS files as the source of truth, so the design can't drift. It fails safe, because a failed build leaves the previous site live, and it fixes the public-files exposure (C) as a side effect. If you later decide to consolidate onto Astro, the Sanity query, templates and sitemap logic carry over.

---

## 4. Phased implementation

Each phase is a separate commit or PR, deployable and revertible on its own. Phases 1, 2 and 4 don't need the build step.

### Phase 0: Baseline and decisions (no deploy)
- Record Lighthouse/PSI for `/` and `/gallery` (mobile and desktop, median of 3), total image bytes, and screenshots at 375 / 820 / 1280 px.
- Check Search Console → Pages, and the Wayback Machine, for any indexed or legacy URLs, so Phase 2's real 404s don't break anything that is actually linked.
- Get answers to the questions below. Evelyn fixes the `the-stale-of-two-siblings` slug in Studio.

### Phase 1: Head fixes, plain HTML (R2) · *depends on: nothing*
- `gallery.html`: canonical and `og:url` → `https://evelynmichaelides.com/gallery`. `sitemap.xml` entry → `/gallery`.
- `index.html`: `og:image` → `gemini-hero.jpg`. Add `og:image:width`/`height`/`alt`, and preconnect for `fonts.googleapis.com` and `fonts.gstatic.com`.
- Both pages: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.
- `index.html`: static JSON-LD for `Person` (Evelyn Michaelides, sculptor, Melbourne AU, Instagram `sameAs`, portrait image) and `WebSite`.
- **Rollback:** `git revert`. No visual change.

### Phase 2: Hosting hygiene (R3) · *depends on: Q1, Q6, Q10*
- `404.html` using the site header and footer, which turns soft 404s into real 404s.
- `_headers` (if Pages, Q6): `X-Frame-Options: DENY`; CSP **in `Content-Security-Policy-Report-Only` first**, allowing `'self'`, `googletagmanager.com`/`google-analytics.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `esm.sh`, `*.sanity.io`/`cdn.sanity.io`, `formspree.io`, hashes for the inline gtag and importmap scripts, and Cloudflare's `/cdn-cgi/` script.
- **HSTS, with one deliberate change from the audit:** start with `max-age=300` and no `preload`, then ramp to `63072000; includeSubDomains; preload` after a clean week. Preload is very hard to undo and commits every subdomain to HTTPS permanently.
- `www` → apex `301`: a Cloudflare Redirect Rule in the dashboard, since `_redirects` can't match on hostname.
- Investigate `access-control-allow-origin: *` on HTML. It's likely a zone or Pages default; remove it if the setting is found.
- **Rollback:** delete the files or revert the commit; dashboard rules toggle off.

### Phase 3: Static rendering (R1: Findings 1, 3, 4 + per-artwork 2, 5) · *depends on: Q1, Q2, slug fix; Q3 for the JSON-LD type*
- **3a.** Add `scripts/build.mjs`, the marker comments, progressive-enhancement changes to `gallery.js` and `selected-works.js`, and the `works/` template. Prerendered cards get `width`/`height` from Sanity metadata (the same 3:4 box as now) and `srcset` using the existing `?w=…&auto=format` params. The gallery "Updated" line uses the newest `_updatedAt`.
- **3b.** Generate `sitemap.xml` with `lastmod` from `_updatedAt` and `<image:image>` entries using resized URLs. Generate an `ItemList` / `CollectionPage` on `/gallery` and a `VisualArtwork` (or `Product`) on each work page.
- **3c.** Test on a **Pages preview branch** first, using the production build settings, so production is untouched.
- **3d.** Switch production build settings and merge. Then create the deploy hook and the Sanity webhook.
- **Rollback:** Pages instant rollback, plus resetting build settings to blank / `/`. The old no-build site still works from the same files.

### Phase 4: Images (R4: Finding 6) · *depends on: nothing (Q5 helps)*
- Hero: replace the CSS `background-image` with an absolutely positioned `<img>` / `<picture>` behind the hero content (`object-fit: cover; object-position: center`, `fetchpriority="high"`, `alt=""`). This gives the identical look while allowing AVIF/WebP plus `srcset` at about 640 / 1280 / 1920 / 2560 w. I prefer this over `image-set()`, which can't select by viewport width. Variants are encoded from `original-gemini-hero.png` so quality matches the deliberate 2026-09 choice. The existing `gemini-hero.jpg` stays as the fallback and as the OG image.
- `width`/`height` on `evelynportrait.jpg` and both `tools.jpeg`. Verify single download; if confirmed, keep the two DOM copies (no layout risk). Re-encode `gilanilogo.jpg` at its rendered size.
- **Tooling:** encode once with a local CLI and commit the outputs. Nothing is added to the repo or build. If you'd rather automate it with `sharp`, that's a new dependency and needs your OK.
- **Rollback:** revert. The original files are never deleted.

### Phase 5: Policy follow-through · *depends on: Q4, plus Phase 2 being clean*
- `robots.txt` updated to match the chosen AI-crawler policy, including `Google-Extended`.
- CSP switched from Report-Only to enforced. HSTS ramped up.
- Optional `apple-touch-icon` and `manifest.webmanifest` (Finding 10).

---

## 5. URL preservation

| URL today | After | How it's guaranteed |
|---|---|---|
| `/` (canonical), `/index.html` → 308 | Unchanged | `index.html` stays at the output root. |
| `/gallery` (canonical), `/gallery.html` → 308 | Unchanged; canonical, `og:url` and sitemap now *agree* with it | `gallery.html` stays at the output root, so Pages keeps the same pretty-URL behaviour. |
| `/#work`, `/#about`, `/#process`, `/#contact` | Unchanged | Section IDs untouched. |
| `/robots.txt`, `/sitemap.xml`, all image and asset paths | Unchanged | Same paths copied into `dist/`. New image variants are additive. |
| Internal `gallery.html` / `index.html#…` links | Unchanged | Kept as-is so Live Server still works locally. Production pays one 308 hop, which is harmless. |
| `/works/<slug>` | **New**, additive | Generated per published item. |
| Unknown paths (currently 200 homepage) | 404 | Intentional. Phase 0 checks Search Console and Wayback first for anything real. |
| `/sanity/*`, dotfiles | 404 | Intentional; never meant to be public. |

**Keeping new artwork URLs stable over time:**
- Slugs become permanent URLs. Fix the typo before launch.
- If a slug is later changed in Studio, the build writes a `_redirects` entry from a small committed `redirects.txt`. A cleaner long-term option is a "previous slugs" field in Studio, which is a schema change and needs your approval.
- Deleting a work turns its page into a 404. If sold or retired pieces should keep their pages and search history, that needs an "archived" approach (Question 9).

---

## 6. Verification per phase

Run against a preview URL first, then production. `$U=https://evelynmichaelides.com`.

| Phase | Check | Pass criteria |
|---|---|---|
| 1 | `curl -s $U/ \| grep -E 'og:image\|twitter:\|preconnect\|ld\+json'` | All present, `og:image` = hero. |
| 1 | `curl -s $U/gallery \| grep canonical` | `…/gallery`, no `.html`. |
| 1 | Rich Results Test and validator.schema.org on `/` | `Person` valid, zero errors. |
| 1 | Facebook Sharing Debugger, LinkedIn Post Inspector, a third-party X/Twitter card preview tool (X's validator no longer previews) | Hero image and correct title. |
| 2 | `curl -s -o /dev/null -w '%{http_code}' $U/not-a-page` | `404`. |
| 2 | `curl -sI $U/ \| grep -iE 'strict-transport\|x-frame\|content-security'` | Present. Browser console shows no CSP report violations across both pages, the lightbox and form submit. |
| 2 | `curl -sI https://www.evelynmichaelides.com/` | `301` → apex. |
| 3 | `curl -sL $U/ \| grep -c 'class="work-card'` vs Sanity `count(*[_type=="galleryItem" && featured])` | Equal, and no "coming soon" text present. |
| 3 | `curl -sL $U/gallery \| grep -c 'class="work-card'` vs `count(*[_type=="galleryItem"])` | Equal (16 today). |
| 3 | For every `<loc>` in the sitemap: `curl -s -o /dev/null -w '%{http_code}'` | All `200`, none redirecting. Count = 2 + items. Every `<url>` has `<lastmod>`. Passes `xmllint --noout`. |
| 3 | Each `/works/<slug>`: raw HTML has the title, description, `<img>` with `width`/`height`, self-canonical, OG tags and valid JSON-LD | Rich Results Test zero errors on at least 2 works. |
| 3 | `curl -s -o /dev/null -w '%{http_code}' $U/sanity/package.json` | `404`. |
| 3 | Behaviour: click a card → lightbox opens; arrows, Escape and Tab focus trap work; JS disabled → card navigates to work page; Live Server on the source still renders via fallback | All behave as before. |
| 3 | Failure drill on preview: set a wrong dataset env var → build fails | Production deployment unchanged. |
| 3 | Publish a test edit in Studio (Evelyn, or with her OK) | Live within about 2 minutes via webhook. |
| 3 | Search Console: URL Inspection → "Test live URL" on `/gallery` and one work; submit sitemap | Crawled HTML contains artwork titles; sitemap processed with no errors. |
| 4 | Lighthouse/PSI median of 3 vs Phase 0 baseline; DevTools network at 375 / 1280 px | LCP improves, no CLS from portrait/tools, image bytes reduced, `tools.jpeg` fetched once. |
| All | Screenshot diff at 375 / 820 / 1280 px vs Phase 0 (ad hoc `npx playwright`, not added to the repo) | No visual change to existing pages. |

---

## 7. Questions before I proceed

1. **Deployment.** Evidence points to Cloudflare Pages with Git integration (production branch `main`, no build command, output = repo root). Can you confirm in the Pages dashboard: project name, production branch, build command, output directory, Node version, and whether preview deployments are on? Who owns the Cloudflare account, you or Evelyn? **Is adding a build step (Option A's settings change) acceptable?**
2. **Build script or framework?** I recommend Option A (dependency-free Node script). Do you want A, or a move to Astro (B), for example to align with your other artist sites?
3. **`VisualArtwork` or `Product`?** The site says pieces are hand-carved to order and enquiry-based, with no prices. I recommend `VisualArtwork`. `Product` only earns rich results with a price or offer, so without prices it would produce validator warnings. Will prices or availability ever be shown?
4. **AI-crawler policy.** Cloudflare currently blocks training crawlers (GPTBot, ClaudeBot, CCBot, Amazonbot, Bytespider) while `robots.txt` allows everything, and AI *search* agents are allowed. Is that the intended posture? Should `robots.txt` be made to match it, and should `Google-Extended` be opted out?
5. **`original-gemini-hero.png`.** It is **not** deployed (confirmed live). Can I use it as the encoding source in Phase 4? Afterwards, should it stay where it is, move to a git-ignored source-assets folder, or be ignored via `.gitignore`? (I won't move it without your say-so.)
6. **Response headers.** Should they live in a versioned `_headers` file in the repo (my recommendation, Pages-only) or in Cloudflare dashboard Transform Rules? Is the staged HSTS ramp (short `max-age` first, `preload` later) OK, rather than the audit's immediate `preload`?

Also found along the way:

7. **Slug typo.** Can Evelyn change `the-stale-of-two-siblings` → `the-tale-of-two-siblings` in Studio before Phase 3?
8. **Artwork URLs and links.** Is `/works/<slug>` OK? Should homepage "Selected Works" cards link to their pages (they're currently non-clickable)? Should the lightbox get a small "View details" link? Both are behaviour changes, so I'll leave them out unless you say yes.
9. **Sold or retired pieces.** Keep their pages as an archive, or let them 404 when removed from Sanity? Keeping them would need a small Studio schema addition later.
10. **Phase 2 items.** OK to add a real 404 page and a `www` → apex redirect?
