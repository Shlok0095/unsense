/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        void: "#030712",
        panel: "#0a0f1a",
        surface: "#111827",
        edge: "#1e293b",
        neon: "#00ff9c",
        neonDim: "#00cc7a",
        cyan: "#22d3ee",
        danger: "#ff3b5c",
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 255, 156, 0.15)",
        panel: "0 0 0 1px rgba(0, 255, 156, 0.08)",
      },
      animation: {
        pulseSlow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        blink: "blink 1.2s step-end infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
