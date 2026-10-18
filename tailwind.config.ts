import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Specter brand palette (placeholder values — swap for approved brand colors).
        // DEFAULT / dark / light are kept for existing class names.
        brand: {
          DEFAULT: "#0d9488",
          dark: "#0f766e",
          light: "#5eead4",
          50: "#effefb",
          100: "#c8fff4",
          200: "#91fee9",
          300: "#53f5db",
          400: "#1fe0c7",
          500: "#06c4ae",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        accent: {
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
        ink: {
          900: "#0b1324",
          950: "#060b17",
        },
        clinical: {
          bg: "#f4f7fb",
          border: "#e3e8ef",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,0.04), 0 4px 16px -4px rgba(16,24,40,0.08)",
        lift: "0 2px 4px rgba(16,24,40,0.04), 0 16px 32px -12px rgba(16,24,40,0.18)",
        glow: "0 8px 24px -8px rgba(13,148,136,0.55)",
        "inner-line": "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
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
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        wave: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-in-up": "fade-in-up 0.45s ease-out both",
        "scale-in": "scale-in 0.35s ease-out both",
        "slide-in-left": "slide-in-left 0.28s cubic-bezier(0.2,0.8,0.2,1) both",
        shimmer: "shimmer 1.6s infinite",
        float: "float 6s ease-in-out infinite",
        wave: "wave 14s linear infinite",
        "wave-slow": "wave 22s linear infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.2,0.6,0.4,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
