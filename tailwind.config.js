/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:        "#050b14",
        "bg-2":    "#0a1628",
        cyan:      "#00c8ff",
        green:     "#00e87a",
        yellow:    "#ffcc00",
        orange:    "#ff8c00",
        purple:    "#a855f7",
        red:       "#ff4444",
        text:      "#d0e8ff",
        "text-dim": "#6a8aaa",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        "glow-cyan":   "0 0 12px rgba(0, 200, 255, 0.5), 0 0 30px rgba(0, 200, 255, 0.18)",
        "glow-green":  "0 0 12px rgba(0, 232, 122, 0.5)",
        "glow-yellow": "0 0 12px rgba(255, 204, 0, 0.5)",
        "glow-purple": "0 0 16px rgba(168, 85, 247, 0.55)",
      },
    },
  },
  plugins: [],
};
