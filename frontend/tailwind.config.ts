import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        primary: {
          50: "#e6ecf2",
          100: "#c0d0e0",
          200: "#96b1cc",
          300: "#6c92b8",
          400: "#4d7ba8",
          500: "#2e6499",
          600: "#275a8e",
          700: "#1e4d7f",
          800: "#174070",
          900: "#0f2b46",
        },
        accent: {
          50: "#e6f6f5",
          100: "#b3e5e1",
          200: "#80d4ce",
          300: "#4dc3ba",
          400: "#26b5ab",
          500: "#0d9488",
          600: "#0b877c",
          700: "#09756b",
          800: "#07635b",
          900: "#04463f",
        },
        surface: {
          light: "#f8fafc",
          dark: "#0f172a",
        },
      },
      borderRadius: {
        card: "8px",
        input: "6px",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "scale-in": "scaleIn 200ms ease-out",
        "slide-in-left": "slideInLeft 200ms ease-out",
        "slide-in-right": "slideInRight 200ms ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
