import sanityClient from "./sanityClient.js";

const HERO_QUERY = '*[_type == "hero"][0]{title, lead, "imageUrl": image.asset->url}';

document.addEventListener("DOMContentLoaded", () => {
  const hero = document.getElementById("hero");
  const title = document.getElementById("hero-title");
  const lead = document.getElementById("hero-lead");

  if (!hero) return;

  const loadHero = async () => {
    try {
      const data = await sanityClient.fetch(HERO_QUERY);
      if (!data) return;

      if (data.title && title) title.textContent = data.title;
      if (data.lead && lead) lead.textContent = data.lead;
      if (data.imageUrl) {
        hero.style.backgroundImage = `url("${data.imageUrl}?w=2000&auto=format")`;
      }
    } catch (error) {
      console.error("Error fetching hero content from Sanity:", error);
    }
  };

  loadHero();
});
