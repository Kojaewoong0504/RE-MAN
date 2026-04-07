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
        ink: "#111111",
        accent: "#F5F500",
        surface: "#1E1E1E",
        muted: "#888888",
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
