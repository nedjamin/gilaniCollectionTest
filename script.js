document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#primary-nav");
  const header = document.querySelector(".site-header");

  if (!navToggle || !nav || !header) return;

  document.body.classList.add("has-nav-js");

  const closeNav = () => {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll(".nav__link").forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) {
      closeNav();
    }
  });

  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateHeaderVisibility = () => {
    const currentY = window.scrollY;
    const scrollingDown = currentY > lastScrollY;
    const nearTop = currentY < 40;
    const navOpen = nav.classList.contains("is-open");

    if (navOpen || nearTop) {
      header.classList.remove("site-header--hidden");
    } else if (scrollingDown) {
      header.classList.add("site-header--hidden");
    } else {
      header.classList.remove("site-header--hidden");
    }

    lastScrollY = currentY;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeaderVisibility);
        ticking = true;
      }
    },
    { passive: true }
  );
});

// Form submit animation + Formspree fetch (no redirect)
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form.form");
  const submitBtn = form ? form.querySelector(".button--submit") : null;
  if (!form || !submitBtn) return;

  const endpoint = form.getAttribute("action");

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (submitBtn.disabled) return;

    submitBtn.classList.add("is-sent");
    submitBtn.disabled = true;

    const formData = new FormData(form);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Form submit failed (${res.status})`);
      }

      form.reset();
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => {
        submitBtn.classList.remove("is-sent");
        submitBtn.disabled = false;
      }, 1200);
    }
  });
});
