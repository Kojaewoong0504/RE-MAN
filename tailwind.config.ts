import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        accent: "var(--color-accent)",
        surface: "var(--color-surface)",
        muted: "var(--color-muted)",
        success: "#4ADE80",
        danger: "#F87171"
      },
      fontFamily: {
        sans: ["Pretendard", "Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
