import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Step 1 Compass",
    short_name: "Step 1",
    description: "A daily study companion for USMLE Step 1 prep.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#2c5b4f",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
