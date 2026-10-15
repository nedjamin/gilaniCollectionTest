#!/usr/bin/env node
// Local preview server that mimics Cloudflare Pages static serving closely
// enough to test this site before deploying. No dependencies.
//
//   node scripts/preview.mjs [dir=dist] [port=8788]
//
// Emulated: extensionless URLs (/gallery -> gallery.html), 308 redirects from
// /x.html -> /x and /x/index.html -> /x/, nearest 404.html with status 404
// (or SPA-style fallback to /index.html when there is no top-level 404.html),
// _headers rules (splats, ":name" placeholders, "! Header" detach), and Pages'
// default headers. Not emulated: _redirects, Functions, compression, caching.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 8788);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript", ".mjs": "application/javascript",
  ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2",
};
const DEFAULT_HEADERS = {
  "access-control-allow-origin": "*",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "cache-control": "public, max-age=0, must-revalidate",
};

function parseHeadersFile() {
  const file = path.join(root, "_headers");
  if (!fs.existsSync(file)) return [];
  const rules = [];
  let current = null;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), set: [], detach: [] };
      rules.push(current);
    } else if (current) {
      const line = raw.trim();
      if (line.startsWith("! ")) current.detach.push(line.slice(2).trim().toLowerCase());
      else {
        const i = line.indexOf(":");
        current.set.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
      }
    }
  }
  return rules.map((r) => {
    const pathPart = r.pattern.replace(/^https?:\/\/[^/]+/, "");
    const re = "^" + pathPart
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "(?<splat>.*)")
      .replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$";
    return { ...r, re: new RegExp(re) };
  });
}

function applyHeaders(res, urlPath, status, type, extra = {}) {
  const headers = { ...DEFAULT_HEADERS, ...(type ? { "content-type": type } : {}), ...extra };
  for (const rule of parseHeadersFile()) {
    const m = urlPath.match(rule.re);
    if (!m) continue;
    for (const [k, v] of rule.set) {
      const val = v.replace(/:(\w+)/g, (s, n) => (m.groups && n in m.groups ? m.groups[n] : s));
      headers[k] = headers[k] && !DEFAULT_HEADERS[k] ? `${headers[k]}, ${val}` : val;
    }
    for (const k of rule.detach) delete headers[k];
  }
  res.writeHead(status, headers);
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

function resolve(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const abs = path.join(root, rel);
  if (!abs.startsWith(root)) return { status: 403 };
  if (urlPath.endsWith("/index.html")) return { redirect: urlPath.slice(0, -"index.html".length) };
  if (urlPath.endsWith(".html") && isFile(abs)) return { redirect: urlPath.slice(0, -5) || "/" };
  if (urlPath.endsWith("/")) {
    if (isFile(path.join(abs, "index.html"))) return { file: path.join(abs, "index.html") };
    const trimmed = urlPath.replace(/\/+$/, "");
    if (trimmed && isFile(path.join(root, trimmed.slice(1) + ".html"))) return { redirect: trimmed };
  } else {
    if (isFile(abs)) return { file: abs };
    if (isFile(abs + ".html")) return { file: abs + ".html" };
    if (isFile(path.join(abs, "index.html"))) return { redirect: urlPath + "/" };
  }
  // not found: nearest 404.html, else SPA fallback
  if (!isFile(path.join(root, "404.html"))) return { file: path.join(root, "index.html"), spa: true };
  let dir = path.dirname(abs);
  while (dir.startsWith(root)) {
    if (isFile(path.join(dir, "404.html"))) return { file: path.join(dir, "404.html"), status: 404 };
    dir = path.dirname(dir);
  }
  return { file: path.join(root, "404.html"), status: 404 };
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const r = resolve(url.pathname);
  if (r.status === 403) { res.writeHead(403).end(); return; }
  if (r.redirect) {
    applyHeaders(res, url.pathname, 308, null, { location: r.redirect + url.search });
    res.end(); return;
  }
  const type = TYPES[path.extname(r.file).toLowerCase()] || "application/octet-stream";
  applyHeaders(res, url.pathname, r.status || 200, type);
  if (req.method === "HEAD") { res.end(); return; }
  fs.createReadStream(r.file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
