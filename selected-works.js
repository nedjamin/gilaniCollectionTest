import sanityClient from "./sanityClient.js";

const SELECTED_QUERY =
  '*[_type == "galleryItem" && featured == true] | order(order asc, _updatedAt desc) { _id, title, "slug": slug.current, description, featured, order, "imageUrl": image.asset->url }';

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("selected-works");
  const emptyState = document.getElementById("selected-works-empty");

  if (!grid) return;

  const showEmpty = () => {
    if (emptyState) emptyState.hidden = false;
  };

  const renderItems = (items) => {
    if (!items || !items.length) {
      showEmpty();
      return;
    }

    grid.innerHTML = "";
    items.forEach((item) => grid.appendChild(renderCard(item)));
  };

  const loadSelected = async () => {
    try {
      const items = await sanityClient.fetch(SELECTED_QUERY);
      console.log("Sanity selected works:", items);
      renderItems(items);
    } catch (error) {
      console.error("Error fetching selected works from Sanity:", error);
      showEmpty();
    }
  };

  loadSelected();
});

function renderCard(item) {
  const article = document.createElement("article");
  article.className = "work-card";

  const imageBox = document.createElement("div");
  imageBox.className = "work-card__image";

  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = item.title || "Selected work";
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
