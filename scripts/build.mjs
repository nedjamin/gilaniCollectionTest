#!/usr/bin/env node
// Static build for evelynmichaelides.com. No dependencies, Node 18+.
//
//   node scripts/build.mjs            -> writes dist/
//   ALLOW_EMPTY=1 node scripts/build.mjs   (only if the gallery is meant to be empty)
//
// What it does (see DEPLOY.md):
//   1. Reads published gallery items from Sanity's live API (public, read-only, no token).
//   2. Copies the public site files into dist/ (explicit allowlist: top-level files
//      with web extensions + images/; never sanity/, scripts/, templates/, *.md, dotfiles).
//   3. Renders the artwork cards into index.html and gallery.html (same markup the
//      browser scripts used to build at runtime), so they're in the raw HTML.
//   4. Writes one page per artwork at dist/works/<slug>.html (served as /works/<slug>).
//   5. Writes sitemap.xml (all pages, lastmod, image entries) and JSON-LD.
//   6. Refreshes the CSP script hashes in dist/_headers to match the inline scripts.
//
// The build fails (exit 1) rather than publish a broken or empty site: Cloudflare
// Pages then keeps serving the previous successful deployment.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist");
const SITE = "https://evelynmichaelides.com";
const PERSON_ID = `${SITE}/#person`;
const WEBSITE_ID = `${SITE}/#website`;
const PUBLIC_EXT = new Set([".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg", ".ico", ".txt", ".xml", ".webmanifest"]);
const PUBLIC_DIRS = ["images"];
const PUBLIC_EXTRA = ["_headers", "_redirects"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------- helpers ----------
const fail = (msg) => { console.error(`\nBUILD FAILED: ${msg}\n`); process.exit(1); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsonForScript = (v, space) => JSON.stringify(v, null, space).replace(/</g, "\\u003c");
const jsonLd = (graph) => `<script type="application/ld+json">\n${jsonForScript({ "@context": "https://schema.org", "@graph": graph }, 2)}\n  </script>`;
const img = (url, w, extra = "") => (url ? `${url}?w=${w}${extra}&auto=format` : "");
const scaledHeight = (item, w) => (item.imageWidth && item.imageHeight ? Math.round((w * item.imageHeight) / item.imageWidth) : null);
const workPath = (item) => `/works/${item.slug}`;
const maxDate = (...dates) => dates.flat().filter(Boolean).sort().at(-1);
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,;:.\s]+$/, "") + "…");

function replaceOnce(html, marker, replacement, file) {
  const count = html.split(marker).length - 1;
  if (count !== 1) fail(`expected marker ${marker} exactly once in ${file}, found ${count}`);
  return html.replace(marker, () => replacement);
}

function gitDate(file) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch { return null; }
}

// ---------- 1. fetch ----------
function sanityConfig() {
  const src = read("sanityClient.js"); // single source of truth for project/dataset
  const get = (k) => (src.match(new RegExp(`${k}:\\s*["']([^"']+)["']`)) || [])[1];
  const cfg = { projectId: get("projectId"), dataset: get("dataset"), apiVersion: get("apiVersion") };
  if (!cfg.projectId || !cfg.dataset || !cfg.apiVersion) fail("could not read projectId/dataset/apiVersion from sanityClient.js");
  return cfg;
}

const QUERY = `*[_type == "galleryItem" && !(_id in path("drafts.**"))] | order(order asc, _updatedAt desc) {
  _id, _updatedAt, title, "slug": slug.current, description, dimensions, featured, order,
  "imageUrl": image.asset->url,
  "imageWidth": image.asset->metadata.dimensions.width,
  "imageHeight": image.asset->metadata.dimensions.height
}`;

async function fetchItems() {
  const { projectId, dataset, apiVersion } = sanityConfig();
  // Live API, not the CDN (apicdn): the Sanity webhook fires the instant Evelyn publishes,
  // and the CDN can briefly still serve the previous version. Public dataset, no token.
  const url = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(QUERY)}`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      if (!Array.isArray(body.result)) throw new Error("unexpected response shape");
      return body.result;
    } catch (err) {
      lastErr = err;
      console.warn(`Sanity fetch attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  fail(`could not fetch gallery items from Sanity: ${lastErr.message}`);
}

function validate(items) {
  if (!items.length && process.env.ALLOW_EMPTY !== "1") {
    fail("Sanity returned 0 gallery items. Refusing to publish an empty gallery. Set ALLOW_EMPTY=1 if this is intentional.");
  }
  const seen = new Set();
  for (const it of items) {
    if (!it.title) fail(`item ${it._id} has no title`);
    if (!it.slug || !SLUG_RE.test(it.slug)) fail(`item "${it.title}" has a missing or invalid slug "${it.slug}" (use lowercase letters, numbers and hyphens)`);
    if (seen.has(it.slug)) fail(`duplicate slug "${it.slug}"`);
    seen.add(it.slug);
  }
}

// ---------- 2. copy public files ----------
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function copyPublic() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!e.isFile() || e.name.startsWith(".")) continue;
    if (PUBLIC_EXT.has(path.extname(e.name).toLowerCase()) || PUBLIC_EXTRA.includes(e.name)) {
      fs.copyFileSync(path.join(ROOT, e.name), path.join(OUT, e.name));
    }
  }
  for (const d of PUBLIC_DIRS) if (fs.existsSync(path.join(ROOT, d))) copyDir(path.join(ROOT, d), path.join(OUT, d));
}

// ---------- 3. cards (must match renderCard() in gallery.js / selected-works.js) ----------
function placeholderImage() {
  return `<div class="work-card__image gallery-placeholder"><span class="gallery-placeholder__label">Image coming soon</span></div>`;
}

function selectedCard(item) {
  const h = scaledHeight(item, 800);
  const image = item.imageUrl
    ? `<div class="work-card__image"><img src="${esc(img(item.imageUrl, 800))}" alt="${esc(item.title)}" loading="lazy" decoding="async" width="800"${h ? ` height="${h}"` : ""}></div>`
    : placeholderImage();
  return `<article class="work-card">${image}<div class="work-card__meta"><h3 class="work-card__title">${esc(item.title)}</h3><p class="work-card__text">${esc(item.description || "Details coming soon.")}</p></div></article>`;
}

function galleryCard(item, index) {
  const h = scaledHeight(item, 640);
  const loading = index < 4 ? "" : ` loading="lazy"`; // first row is above the fold
  const image = item.imageUrl
    ? `<div class="work-card__image"><img src="${esc(img(item.imageUrl, 640))}" alt="${esc(item.title)}"${loading} decoding="async" width="640"${h ? ` height="${h}"` : ""}><span class="work-card__expand"><img src="enlargesymbol.png" alt="" aria-hidden="true"></span></div>`
    : placeholderImage();
  const dims = item.dimensions ? `<p class="work-card__subtitle">${esc(item.dimensions)}</p>` : "";
  return `<a class="work-card" href="${workPath(item)}" aria-label="${esc(item.title)}">${image}<div class="work-card__meta"><h3 class="work-card__title">${esc(item.title)}</h3><p class="work-card__text">${esc(item.description || "Details coming soon.")}</p>${dims}</div></a>`;
}

const personRef = { "@type": "Person", "@id": PERSON_ID, name: "Evelyn Michaelides", url: `${SITE}/` };

function renderHome(items) {
  const file = "index.html";
  const featured = items.filter((i) => i.featured === true);
  let html = fs.readFileSync(path.join(OUT, file), "utf8");
  html = replaceOnce(html, `<div class="work-grid" id="selected-works" aria-live="polite">`, `<div class="work-grid" id="selected-works" aria-live="polite" data-prerendered="true">`, file);
  html = replaceOnce(html, "<!-- build:selected-works -->", featured.map(selectedCard).join("\n          "), file);
  // The "coming soon" fallback is shown only when there is genuinely nothing to show.
  html = featured.length
    ? replaceOnce(html, `<p class="gallery-empty" id="selected-works-empty" hidden>New selected works coming soon.</p>`, "", file)
    : replaceOnce(html, `id="selected-works-empty" hidden>`, `id="selected-works-empty">`, file);
  fs.writeFileSync(path.join(OUT, file), html);
  return featured;
}

function renderGallery(items) {
  const file = "gallery.html";
  let html = fs.readFileSync(path.join(OUT, file), "utf8");
  html = replaceOnce(html, `<div class="gallery-grid" id="gallery-grid" aria-live="polite">`, `<div class="gallery-grid" id="gallery-grid" aria-live="polite" data-prerendered="true">`, file);
  html = replaceOnce(html, "<!-- build:gallery-grid -->", items.map(galleryCard).join("\n        "), file);
  html = items.length
    ? replaceOnce(html, `<p class="gallery-empty" id="gallery-empty" hidden>New works coming soon.</p>`, "", file)
    : replaceOnce(html, `id="gallery-empty" hidden>`, `id="gallery-empty">`, file);
  // Data for the lightbox, so the browser doesn't have to re-query Sanity.
  const data = items.map(({ title, slug, description, dimensions, imageUrl }) => ({ title, slug, description, dimensions, imageUrl }));
  html = replaceOnce(html, "<!-- build:gallery-data -->", `<script type="application/json" id="gallery-data">${jsonForScript(data)}</script>`, file);

  const pageUrl = `${SITE}/gallery`;
  const graph = [
    {
      "@type": "CollectionPage", "@id": pageUrl, url: pageUrl,
      name: "Gilani Collection by Evelyn Michaelides — Gallery",
      description: "Browse the full catalogue of limestone and hebel sculptures by Evelyn Michaelides in the Gilani Collection gallery.",
      isPartOf: { "@id": WEBSITE_ID }, about: { "@id": PERSON_ID },
      mainEntity: { "@id": `${pageUrl}#works` }, breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
    },
    {
      "@type": "ItemList", "@id": `${pageUrl}#works`, name: "Gilani Collection", numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + workPath(it), name: it.title })),
    },
    breadcrumbs(`${pageUrl}#breadcrumb`, [["Home", `${SITE}/`], ["Gallery", pageUrl]]),
    personRef,
  ];
  html = replaceOnce(html, "<!-- build:gallery-jsonld -->", jsonLd(graph), file);
  fs.writeFileSync(path.join(OUT, file), html);
}

function breadcrumbs(id, trail) {
  return {
    "@type": "BreadcrumbList", "@id": id,
    itemListElement: trail.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, ...(item ? { item } : {}) })),
  };
}

// ---------- 4. work pages ----------
function renderWorks(items) {
  const template = read("templates/work.html");
  fs.mkdirSync(path.join(OUT, "works"), { recursive: true });
  items.forEach((item, i) => {
    const url = SITE + workPath(item);
    const pageTitle = `${item.title} — Gilani Collection by Evelyn Michaelides`;
    const alt = `${item.title}, a hand-carved sculpture by Evelyn Michaelides`;
    const metaDescription = item.description
      ? truncate(item.description.replace(/\s+/g, " ").trim(), 155)
      : `${item.title}: a hand-carved sculpture by Evelyn Michaelides, Gilani Collection. Made to order in Melbourne, Australia.`;

    const W = item.imageWidth || 1600;
    const widths = [800, 1200, 1600].filter((w) => w < W).concat(Math.min(W, 1600)).filter((w, k, a) => a.indexOf(w) === k);
    const mainW = Math.min(1200, W);
    const media = item.imageUrl
      ? `<figure class="work-detail__media"><img src="${esc(img(item.imageUrl, mainW))}" srcset="${widths.map((w) => `${esc(img(item.imageUrl, w))} ${w}w`).join(", ")}" sizes="(max-width: 900px) 100vw, 640px" width="${mainW}"${scaledHeight(item, mainW) ? ` height="${scaledHeight(item, mainW)}"` : ""} alt="${esc(alt)}" fetchpriority="high" decoding="async"></figure>`
      : `<figure class="work-detail__media">${placeholderImage()}</figure>`;
    const ogW = Math.min(1200, W);
    const ogImage = item.imageUrl ? `${item.imageUrl}?w=${ogW}&fm=jpg&q=82` : `${SITE}/gemini-hero.jpg`;
    const ogH = item.imageUrl ? scaledHeight(item, ogW) || "" : 1184;

    const prev = items[i - 1], next = items[i + 1];
    const pager = prev || next
      ? `<nav class="work-detail__pager" aria-label="More works">${prev ? `<a href="${workPath(prev)}" rel="prev">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="${workPath(next)}" rel="next">${esc(next.title)} →</a>` : ""}</nav>`
      : "";

    const artwork = {
      "@type": "VisualArtwork", "@id": `${url}#artwork`, name: item.title, url,
      artform: "Sculpture",
      creator: { "@id": PERSON_ID },
      isPartOf: { "@id": `${SITE}/gallery` },
      mainEntityOfPage: { "@id": url },
      ...(item.description ? { description: item.description } : {}),
      ...(item.dimensions ? { size: item.dimensions } : {}),
      ...(item.imageUrl ? { image: { "@type": "ImageObject", url: img(item.imageUrl, Math.min(1600, W)), width: Math.min(1600, W), ...(scaledHeight(item, Math.min(1600, W)) ? { height: scaledHeight(item, Math.min(1600, W)) } : {}) } } : {}),
    };
    const graph = [
      artwork,
      {
        "@type": "WebPage", "@id": url, url, name: pageTitle, dateModified: item._updatedAt,
        isPartOf: { "@id": WEBSITE_ID }, mainEntity: { "@id": `${url}#artwork` }, breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      breadcrumbs(`${url}#breadcrumb`, [["Home", `${SITE}/`], ["Gallery", `${SITE}/gallery`], [item.title, url]]),
      personRef,
    ];

    const vars = {
      PAGE_TITLE: pageTitle, META_DESCRIPTION: metaDescription, URL: url, TITLE: item.title,
      OG_IMAGE: ogImage, OG_IMAGE_WIDTH: item.imageUrl ? ogW : 2843, OG_IMAGE_HEIGHT: ogH, IMAGE_ALT: alt,
      JSONLD_HTML: jsonLd(graph),
      MEDIA_HTML: media,
      DIMENSIONS_HTML: item.dimensions ? `<p class="work-detail__dimensions">${esc(item.dimensions)}</p>` : "",
      DESCRIPTION_HTML: item.description ? item.description.split(/\n\s*\n/).map((p) => `<p class="about__body">${esc(p.trim()).replace(/\s*\n\s*/g, "<br>\n")}</p>`).join("\n            ") : "",
      PAGER_HTML: pager,
    };
    const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
      if (!(key in vars)) fail(`templates/work.html uses unknown placeholder ${m}`);
      return key.endsWith("_HTML") ? vars[key] : esc(vars[key]);
    });
    fs.writeFileSync(path.join(OUT, "works", `${item.slug}.html`), html);
  });
}

// ---------- 5. sitemap ----------
function renderSitemap(items, featured) {
  const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const day = (iso) => (iso ? new Date(iso).toISOString() : null);
  const entries = [
    { loc: `${SITE}/`, lastmod: maxDate(gitDate("index.html"), featured.map((i) => i._updatedAt)),
      images: ["gemini-hero.jpg", "evelynportrait.jpg", "tools.jpeg"].map((f) => `${SITE}/${f}`) },
    { loc: `${SITE}/gallery`, lastmod: maxDate(gitDate("gallery.html"), items.map((i) => i._updatedAt)), images: [] },
    ...items.map((it) => ({
      loc: SITE + workPath(it), lastmod: it._updatedAt,
      images: it.imageUrl ? [img(it.imageUrl, Math.min(1200, it.imageWidth || 1200))] : [],
    })),
  ];
  const body = entries.map((e) => [
    "  <url>",
    `    <loc>${xmlEsc(e.loc)}</loc>`,
    e.lastmod ? `    <lastmod>${day(e.lastmod)}</lastmod>` : null,
    ...e.images.map((u) => `    <image:image><image:loc>${xmlEsc(u)}</image:loc></image:image>`),
    "  </url>",
  ].filter(Boolean).join("\n")).join("\n");
  fs.writeFileSync(path.join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`);
  return entries.length;
}

// ---------- 6. CSP hashes ----------
function refreshCspHashes() {
  const headersFile = path.join(OUT, "_headers");
  if (!fs.existsSync(headersFile)) return 0;
  const hashes = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) {
        for (const [, attrs, body] of fs.readFileSync(p, "utf8").matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
          if (/\ssrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs)) continue; // data blocks aren't executed
          hashes.add(`'sha256-${crypto.createHash("sha256").update(body).digest("base64")}'`);
        }
      }
    }
  };
  walk(OUT);
  const text = fs.readFileSync(headersFile, "utf8").replace(/(script-src [^;]*)/g, (directive) =>
    directive.replace(/\s*'sha256-[^']+'/g, "").replace(/^script-src 'self'/, `script-src 'self' ${[...hashes].sort().join(" ")}`));
  fs.writeFileSync(headersFile, text);
  return hashes.size;
}

// ---------- main ----------
const started = Date.now();
const items = await fetchItems();
validate(items);
copyPublic();
const featured = renderHome(items);
renderGallery(items);
renderWorks(items);
const urlCount = renderSitemap(items, featured);
const hashCount = refreshCspHashes();

// Final guard: no unreplaced markers or placeholders anywhere in the output.
for (const f of ["index.html", "gallery.html", ...items.map((i) => `works/${i.slug}.html`)]) {
  const html = fs.readFileSync(path.join(OUT, f), "utf8");
  if (/<!-- build:|\{\{[A-Z_]+\}\}/.test(html)) fail(`unreplaced marker or placeholder in dist/${f}`);
}
console.log(`Built dist/ in ${Date.now() - started} ms: ${items.length} works (${featured.length} featured), ${urlCount} sitemap URLs, ${hashCount} CSP script hashes.`);
