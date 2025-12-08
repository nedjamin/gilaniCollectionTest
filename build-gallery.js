const fs = require("fs");
const path = require("path");

// Builds gallery-data.json from markdown files in content/gallery.
const galleryDir = path.join(__dirname, "content", "gallery");
const outputPath = path.join(__dirname, "gallery-data.json");

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) {
    return { frontmatter: {}, body: raw };
  }

  const closingIndex = raw.indexOf("\n---", 3);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: raw };
  }

  const frontmatterBlock = raw.slice(3, closingIndex).trim();
  const body = raw.slice(closingIndex + 4).trim();
  const frontmatter = {};

  frontmatterBlock.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const [rawKey, ...rawValueParts] = trimmed.split(":");
    if (!rawKey || rawValueParts.length === 0) return;

    const key = rawKey.trim();
    const valueRaw = rawValueParts.join(":").trim();
    if (!key || !valueRaw) return;

    let value = valueRaw.replace(/^["']|["']$/g, "");
    if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
      value = value.toLowerCase() === "true";
    }

    frontmatter[key] = value;
  });

  return { frontmatter, body };
}

function buildGalleryData() {
  if (!fs.existsSync(galleryDir)) {
    console.warn(`Gallery directory not found: ${galleryDir}`);
    return;
  }

  const entries = fs
    .readdirSync(galleryDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(galleryDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      const { frontmatter } = parseFrontmatter(raw);
      const stat = fs.statSync(fullPath);

      return {
        slug: file.replace(/\.md$/, ""),
        title: frontmatter.title || file.replace(/\.md$/, ""),
        description: frontmatter.description || "",
        image: frontmatter.image || "",
        featured:
          frontmatter.featured === true || frontmatter.featured === "true",
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const payload = {
    generatedAt: new Date().toISOString(),
    items: entries,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Gallery data written to ${path.relative(
      process.cwd(),
      outputPath
    )} (${entries.length} item${entries.length === 1 ? "" : "s"})`
  );
}

buildGalleryData();
