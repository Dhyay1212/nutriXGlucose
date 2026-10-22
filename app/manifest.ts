import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NutriX Glucose",
    short_name: "NutriX",
    description: "Snap, type or say a meal and see how it affects your glucose.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f4f9",
    theme_color: "#4338ca",
    categories: ["health", "food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log a meal", short_name: "Log", url: "/log", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Before you eat", short_name: "Check", url: "/check", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Add a reading", short_name: "Reading", url: "/glucose", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
