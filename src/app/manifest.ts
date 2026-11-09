import type { MetadataRoute } from "next";

// Web App Manifest, served at /manifest.webmanifest (public, see middleware).
// Makes the app installable on Android/ChromeOS/Windows/macOS (Chrome, Edge)
// and supplies the home-screen name/icon on iOS alongside the apple-* metadata
// in the root layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "QuinTron Breath Test",
    short_name: "QuinTron",
    description:
      "Breath-test data entry, timed sample collection, charting and signed PDF reports for hospitals — plus a secure portal for patients to view their own reports.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0b1324",
    theme_color: "#0d9488",
    lang: "en",
    dir: "ltr",
    categories: ["medical", "health", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Breath tests",
        short_name: "Tests",
        url: "/tests",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Patients",
        url: "/patients",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Patient portal — my reports",
        short_name: "My reports",
        url: "/portal",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
