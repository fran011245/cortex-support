import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "#0A0F1C",
        foreground: "#E2E8F0",
        card: "#121827",
        primary: "#3B82F6",
        accent: "#0EA5E9",
        muted: "#1E293B",
        border: "#1E293B",
      },
      borderRadius: {
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
