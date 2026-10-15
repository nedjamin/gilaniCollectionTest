// Full gallery page.
// In production the cards are already in the HTML (rendered by scripts/build.mjs) as
// links to /works/<slug>, with the lightbox data embedded in #gallery-data. This script
// only adds the lightbox on top. It fetches from Sanity at runtime only when the page is
// served un-built (e.g. opening the source files locally).
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
    prefetchLightboxImages(items);
  };

  const prefetchLightboxImages = (items) => {
    const urls = items.map((item) => withImageParams(item.imageUrl, 1600)).filter(Boolean);
    let i = 0;
    const prefetchNext = () => {
      if (i >= urls.length) return;
      const img = new Image();
      img.onload = img.onerror = prefetchNext;
      img.src = urls[i];
      i += 1;
    };
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    schedule(prefetchNext);
  };

  // Attach the lightbox to cards that are already in the HTML.
  const hydrate = (items) => {
    setStatus(
      `Updated ${new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`
    );
    galleryItems = items;
    grid.querySelectorAll(".work-card").forEach((card, idx) => bindCard(card, idx, openLightbox));
    if (items.length) prefetchLightboxImages(items);
  };

  const loadGallery = async () => {
    const prerendered = document.getElementById("gallery-data");
    if (grid.dataset.prerendered === "true" && prerendered) {
      try {
        hydrate(JSON.parse(prerendered.textContent));
        return;
      } catch (error) {
        console.error("Could not read prerendered gallery data:", error);
      }
    }
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
    const { default: sanityClient } = await import("./sanityClient.js");
    const items = await sanityClient.fetch(query);
    console.log("Sanity gallery items:", items);
    return items;
  } catch (error) {
    console.error("Error fetching gallery from Sanity:", error);
    throw error;
  }
}

// A card is a real link to the artwork's own page (/works/<slug>), so it works without
// JavaScript and crawlers can follow it. With JavaScript, a plain click (or Enter/Space)
// opens the lightbox instead, as before; Cmd/Ctrl/middle-click still opens the page.
function bindCard(card, index, openLightbox) {
  if (typeof openLightbox !== "function") return;
  card.addEventListener("click", (evt) => {
    if (evt.button !== 0 || evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;
    evt.preventDefault();
    openLightbox(index);
  });
  card.addEventListener("keydown", (evt) => {
    if (evt.key === " ") {
      evt.preventDefault();
      openLightbox(index);
    }
  });
}

// Keep in sync with galleryCard() in scripts/build.mjs.
function renderCard(item, index, openLightbox) {
  const article = document.createElement("a");
  article.className = "work-card";
  if (item.slug) article.href = `/works/${item.slug}`;
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
  bindCard(article, index, openLightbox);

  return article;
}
