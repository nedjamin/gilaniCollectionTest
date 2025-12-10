import sanityClient from "./sanityClient.js";

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
      const items = await fetchSanityGallery();
      renderItems(items, new Date().toISOString());
    } catch (error) {
      console.error(error);
      setStatus("New works coming soon.");
      if (emptyState) emptyState.hidden = false;
    }
  };

  loadGallery();
});

async function fetchSanityGallery() {
  const query =
    '*[_type == "galleryItem"] | order(order asc, _updatedAt desc) { _id, title, "slug": slug.current, description, featured, order, "imageUrl": image.asset->url }';

  try {
    const items = await sanityClient.fetch(query);
    console.log("Sanity gallery items:", items);
    return items;
  } catch (error) {
    console.error("Error fetching gallery from Sanity:", error);
    throw error;
  }
}

function renderCard(item) {
  const article = document.createElement("article");
  article.className = "work-card";

  const imageBox = document.createElement("div");
  imageBox.className = "work-card__image";

  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
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
