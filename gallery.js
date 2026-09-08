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
  let lastFocusedElement = null;

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
    lbImage.src = withImageParams(item.imageUrl, 1600) || "";
    lbImage.alt = item.title || "Gallery piece";
    lbCaption.textContent = [item.title, item.description, item.dimensions]
      .filter(Boolean)
      .join(" — ");
    lastFocusedElement = document.activeElement;
    lightbox.hidden = false;
    lightbox.classList.add("is-open");
    if (lbClose) lbClose.focus();
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.hidden = true;
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
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
    } else if (evt.key === "Tab") {
      const focusable = [lbPrev, lbNext, lbClose].filter(Boolean);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (evt.shiftKey && document.activeElement === first) {
        evt.preventDefault();
        last.focus();
      } else if (!evt.shiftKey && document.activeElement === last) {
        evt.preventDefault();
        first.focus();
      }
    }
  });

  loadGallery();
});

function withImageParams(url, width) {
  if (!url) return url;
  return `${url}?w=${width}&auto=format`;
}

async function fetchSanityGallery() {
  const query =
    '*[_type == "galleryItem"] | order(order asc, _updatedAt desc) { _id, title, "slug": slug.current, description, dimensions, featured, order, "imageUrl": image.asset->url }';

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
    img.src = withImageParams(item.imageUrl, 640);
    img.alt = item.title || "Gallery piece";
    img.loading = "lazy";
    img.decoding = "async";
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

  const dimensions = document.createElement("p");
  dimensions.className = "work-card__subtitle";
  dimensions.textContent = item.dimensions || "";

  const description = document.createElement("p");
  description.className = "work-card__text";
  description.textContent = item.description || "Details coming soon.";

  meta.append(title, description);
  if (item.dimensions) meta.append(dimensions);
  article.append(imageBox, meta);

  if (typeof openLightbox === "function") {
    article.addEventListener("click", () => openLightbox(index));
    article.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        openLightbox(index);
      }
    });
  }

  return article;
}
