document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("gallery-grid");
  const emptyState = document.getElementById("gallery-empty");
  const status = document.getElementById("gallery-status");

  if (!grid) return;

  const setStatus = (message = "") => {
    if (!status) return;
    status.textContent = message;
  };

  fetch("gallery-data.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load gallery data (${response.status})`);
      }
      return response.json();
    })
    .then(({ items = [], generatedAt }) => {
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
      items.forEach((item) => {
        grid.appendChild(renderCard(item));
      });
    })
    .catch((error) => {
      console.error(error);
      setStatus("Gallery is updating — please check back shortly.");
      if (emptyState) emptyState.hidden = false;
    });
});

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
