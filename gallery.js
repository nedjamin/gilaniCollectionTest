const SANITY_PROJECT_ID = "g2n6h8e3";
const SANITY_DATASET = "gallery";
const SANITY_API_VERSION = "v2023-10-01";

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("gallery-grid");
  const emptyState = document.getElementById("gallery-empty");
  const status = document.getElementById("gallery-status");

  if (!grid) return;

  const setStatus = (message = "") => {
    if (!status) return;
    status.textContent = message;
  };

  const renderItems = (items, generatedAt) => {
    const timestamp = generatedAt ? new Date(generatedAt) : null;
    if (timestamp) {
      setStatus(
        `Updated ${timestamp.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}`
      );
    }

    if (!items.length) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    grid.innerHTML = "";
    items.forEach((item) => grid.appendChild(renderCard(item)));
  };

  const loadGallery = async () => {
    try {
      const { items, generatedAt } = await fetchSanityGallery();
      renderItems(items, generatedAt);
    } catch (error) {
      console.error(error);
      setStatus("Gallery is updating — please check back shortly.");
      if (emptyState) emptyState.hidden = false;
    }
  };

  loadGallery();
});

async function fetchSanityGallery() {
  const query =
    '*[_type == "galleryItem"]|order(coalesce(order, 1e12) asc, _updatedAt desc){_id, title, description, "image": image.asset->url, featured, order, _updatedAt}';
  const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sanity request failed (${res.status})`);
  }

  const data = await res.json();
  if (!data || !data.result) {
    return { items: [], generatedAt: new Date().toISOString() };
  }

  const items = data.result.map((item) => ({
    title: item.title,
    description: item.description,
    image: item.image,
    featured: item.featured,
    order: item.order,
    updatedAt: item._updatedAt,
  }));

  return { items, generatedAt: new Date().toISOString() };
}

function renderCard(item) {
  const article = document.createElement("article");
  article.className = "work-card";

  const imageBox = document.createElement("div");
  imageBox.className = "work-card__image";

  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.title || "Gallery piece";
    imageBox.appendChild(img);
  } else {
    imageBox.classList.add("gallery-placeholder");
    const label = document.createElement("span");
    label.className = "gallery-placeholder__label";
    label.textContent = "Image coming soon";
    imageBox.appendChild(label);
  }

  const meta = document.createElement("div");
  meta.className = "work-card__meta";

  const title = document.createElement("h3");
  title.className = "work-card__title";
  title.textContent = item.title || "Untitled";

  const description = document.createElement("p");
  description.className = "work-card__text";
  description.textContent = item.description || "Details coming soon.";

  meta.append(title, description);
  article.append(imageBox, meta);

  return article;
}
