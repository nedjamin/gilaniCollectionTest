import {createClient} from "@sanity/client";

export const sanityClient = createClient({
  projectId: "g2n6h8e3",
  dataset: "gallery",
  apiVersion: "2023-10-01",
  useCdn: true,
});

export default sanityClient;
