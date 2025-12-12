import sanityClient from "./sanityClient.js";

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("gallery-grid");
  const emptyState = document.getElementById("gallery-empty");
  const status = document.getElementById("gallery-status");
  const lightbox = document.getElementById("gallery-lightbox");
  const lbImage = document.getElementById("lb-image");
  const lbCaption = document.getElementById("lb-caption");
  const lbPrev = document.getElementById("lb-prev");
  const lbNext = document.getElementById("lb-next");
  const lbClose = document.getElementById("lb-close");

  let galleryItems = [];
  let activeIndex = 0;

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
    galleryItems = items;
    items.forEach((item, idx) => grid.appendChild(renderCard(item, idx, openLightbox)));
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

  const openLightbox = (index) => {
    if (!lightbox || !lbImage || !lbCaption) return;
    const item = galleryItems[index];
    if (!item) return;
    activeIndex = index;
    lbImage.src = item.imageUrl || "";
    lbImage.alt = item.title || "Gallery piece";
    lbCaption.textContent = item.title
      ? `${item.title}${item.description ? ` — ${item.description}` : ""}`
      : item.description || "";
    lightbox.hidden = false;
    lightbox.classList.add("is-open");
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.hidden = true;
  };

  const showNext = () => {
    if (!galleryItems.length) return;
    openLightbox((activeIndex + 1) % galleryItems.length);
  };

  const showPrev = () => {
    if (!galleryItems.length) return;
    openLightbox((activeIndex - 1 + galleryItems.length) % galleryItems.length);
  };

  if (lbPrev) lbPrev.addEventListener("click", showPrev);
  if (lbNext) lbNext.addEventListener("click", showNext);
  if (lbClose) lbClose.addEventListener("click", closeLightbox);

  if (lightbox) {
    lightbox.addEventListener("click", (evt) => {
      if (evt.target === lightbox) {
        closeLightbox();
      }
    });
  }

  document.addEventListener("keydown", (evt) => {
    if (!lightbox || lightbox.hidden) return;
    if (evt.key === "Escape") {
      closeLightbox();
    } else if (evt.key === "ArrowRight") {
      showNext();
    } else if (evt.key === "ArrowLeft") {
      showPrev();
    }
  });

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

function renderCard(item, index, openLightbox) {
  const article = document.createElement("article");
  article.className = "work-card";
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", item.title || "Gallery piece");

  const imageBox = document.createElement("div");
  imageBox.className = "work-card__image";

  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = item.title || "Gallery piece";
    imageBox.appendChild(img);

    const expand = document.createElement("span");
    expand.className = "work-card__expand";
    const expandIcon = document.createElement("img");
    expandIcon.src = "enlargesymbol.png";
    expandIcon.alt = "";
    expandIcon.setAttribute("aria-hidden", "true");
    expand.appendChild(expandIcon);
    imageBox.appendChild(expand);
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

  if (typeof openLightbox === "function") {
    article.addEventListener("click", () => openLightbox(index));
    article.addEventListener("keypress", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        openLightbox(index);
      }
    });
  }

  return article;
}
