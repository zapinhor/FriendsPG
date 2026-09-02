import type { Config } from "tailwindcss";

// Tokens de identidade visual da Mesa Viva: taverna à meia-luz, não SaaS.
// Ver README > Identidade visual para o raciocínio por trás das cores.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#12141C", // fundo principal
        panel: "#1A1D27", // painéis e cards
        "panel-raised": "#20232F",
        hairline: "#2B2F3D",
        ink: "#E8E6DE", // texto principal, tom pergaminho
        "ink-muted": "#9A9CAE",
        ember: "#C97A3D", // acento quente (ação primária)
        "ember-soft": "#8F5A34",
        arcane: "#6C7BD4", // acento frio (foco/seleção)
        danger: "#B0473F",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        panel: "10px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
