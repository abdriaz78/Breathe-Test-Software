import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Specter brand palette (placeholder values — swap for approved brand colors)
        brand: {
          DEFAULT: "#0f766e",
          dark: "#115e59",
          light: "#5eead4",
        },
        clinical: {
          bg: "#f8fafc",
          border: "#e2e8f0",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-in-up": "fade-in-up 0.45s ease-out both",
        "scale-in": "scale-in 0.35s ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
