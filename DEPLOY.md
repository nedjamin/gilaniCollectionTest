# Deploying evelynmichaelides.com

The site is plain HTML/CSS/JS, plus a small build step (`scripts/build.mjs`, Node only, no npm packages). The build pulls the artworks from Sanity and writes the finished site to `dist/`. Cloudflare Pages serves `dist/`.

## What the build does

- Puts the artwork cards into the HTML of `/` and `/gallery`, so search engines, AI assistants and link previews see real content without running JavaScript.
- Creates one page per artwork at `/works/<slug>`, with its own title, description, social-preview image and structured data.
- Writes `sitemap.xml` with every page, its last-modified date and its images.
- Copies only public files into `dist/`. Top-level files with web extensions plus `images/` are copied. `sanity/`, `scripts/`, `templates/`, `*.md` and dotfiles are never published.
- Updates the CSP script hashes in `_headers` to match the inline scripts.

In the browser, `gallery.js` and `selected-works.js` now only add behaviour (the lightbox). They fetch from Sanity themselves only when the page hasn't been built, e.g. when opening the source files directly.

## Cloudflare Pages settings

Project `gilanicollectiontest` → Settings → Builds:

| Setting | Value |
|---|---|
| Build command | `node scripts/build.mjs` |
| Build output directory | `dist` |
| Root directory | *(blank)* |
| Node | Build image v3 default (Node 18+ is enough) |

These settings are shared by production and preview deployments. Rollback is Deployments → previous deployment → **Rollback**, then clear the two fields above to return to the old no-build setup. The source files still work without a build.

## Publishing from Sanity (automatic rebuilds)

1. **Cloudflare:** Pages project → Settings → Builds → **Deploy hooks** → add a hook named `sanity-publish` for branch `main`. Copy the URL. It's a secret, so don't commit it anywhere.
2. **Sanity:** sanity.io/manage → project *Gilani Collection* → API → **Webhooks** → Create:
   - URL: the deploy-hook URL
   - Dataset: `gallery`
   - Trigger on: Create, Update, Delete
   - Filter: `_type == "galleryItem"`
   - HTTP method: POST. Leave drafts **unchecked**.

Publishing a work then goes live in about 1–2 minutes.

## If something goes wrong

- **The build fails:** if Sanity is unreachable, a slug is missing, invalid or duplicated, or Sanity returns **zero** works, the build stops. Cloudflare keeps serving the last successful deployment, so visitors never see a broken or empty gallery. Check the failed deployment's log in Pages for the reason.
- **The gallery really should be empty:** set the environment variable `ALLOW_EMPTY=1` in Pages for one deploy.
- **A slug is changed in Sanity:** the old `/works/<old-slug>` URL starts returning 404. To keep it working, add a line to a `_redirects` file at the repo root: `/works/old-slug /works/new-slug 301`.
- **A work is deleted in Sanity:** its page returns 404 on the next build. This is intentional.

## Working locally

```sh
node scripts/build.mjs          # writes dist/
node scripts/preview.mjs        # serves dist/ like Cloudflare Pages at http://localhost:8788
```

`preview.mjs` reproduces Pages' clean URLs, its 404 behaviour and `_headers`. Opening the un-built source files (e.g. VS Code Live Server) still works, but cards then load from Sanity in the browser. Sanity only allows that from origins listed in its CORS settings (currently the live domains, `gilanicollectiontest.pages.dev` and `localhost:3333`).

## Things to keep in sync by hand

- **Site header and footer** appear in `index.html`, `gallery.html`, `404.html` and `templates/work.html`. `404.html` and the template use root-absolute links (`/styles.css`, `/#work`) because they're served at any depth.
- **Card markup** is in `scripts/build.mjs` (`selectedCard`, `galleryCard`) and the runtime fallbacks in `selected-works.js` / `gallery.js` (`renderCard`).

## Pending follow-ups

- **CSP:** `_headers` currently has `Content-Security-Policy-Report-Only`. Once the browser console shows no CSP reports on the live site (home, gallery + lightbox, a work page, sending the form), rename it to `Content-Security-Policy`.
- **HSTS:** `max-age=300` for now. After a clean week, change it to `max-age=63072000; includeSubDomains; preload`.
- **www → apex:** Cloudflare dashboard → the `evelynmichaelides.com` zone → Rules → Redirect Rules → template "Redirect from WWW to root", status 301, preserve query string. `_redirects` can't do this because it can't match on hostname.
