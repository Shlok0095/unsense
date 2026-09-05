/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        void: "#020408",
        deep: "#050a12",
        panel: "rgba(10, 16, 28, 0.78)",
        surface: "#0c1220",
        elevated: "#111a2a",
        edge: "rgba(148, 163, 184, 0.16)",
        ice: "#7dd3fc",
        frost: "#38bdf8",
        iceDim: "#5b9fd4",
        cyan: "#67e8f9",
        danger: "#f87171",
        muted: "#64748b",
      },
      boxShadow: {
        glow: "0 0 24px rgba(125, 211, 252, 0.10)",
        panel: "0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(148, 163, 184, 0.10)",
        float: "0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(148, 163, 184, 0.08)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      },
      animation: {
        pulseSlow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        drift: "drift 20s ease-in-out infinite",
        fadeUp: "fadeUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30px, -20px) scale(1.05)" },
          "66%": { transform: "translate(-20px, 15px) scale(0.95)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
