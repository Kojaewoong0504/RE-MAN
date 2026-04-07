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
        accent: "#F2E94E",
        surface: "#F4ECDD",
        muted: "#6B6558",
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
