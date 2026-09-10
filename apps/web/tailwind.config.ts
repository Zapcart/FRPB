import type { Config } from "tailwindcss";

/**
 * FRPB light-mode design tokens.
 * Primary  -> Deep Electric Blue #0066FF (brand)
 * Accent   -> Vibrant Cyan #00A3FF (CTAs, gradients)
 * Ink      -> Slate #0F172A (headlines / dark surfaces)
 * Base     -> White #FFFFFF with slate-50 #F8FAFC section fills
 */
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/shared/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0066FF",
          50: "#EBF2FF",
          100: "#D6E4FF",
          200: "#A8C7FF",
          300: "#7AA6FF",
          400: "#3D82FF",
          500: "#0066FF",
          600: "#0052D6",
          700: "#003FA8",
          800: "#002D7A",
          900: "#001A4D",
        },
        accent: {
          DEFAULT: "#00A3FF",
          50: "#E6F7FF",
          100: "#CCEFFF",
          200: "#99DFFF",
          300: "#66CFFF",
          400: "#33BFFF",
          500: "#00A3FF",
          600: "#0087D6",
          700: "#006BA8",
          800: "#004F7A",
          900: "#00334D",
        },
        ink: "#0F172A",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
        "card-hover": "0 2px 4px rgba(15,23,42,0.05), 0 20px 44px rgba(15,23,42,0.10)",
        glow: "0 0 0 1px rgba(0,102,255,0.08), 0 8px 30px rgba(0,102,255,0.18)",
        "blue-glow": "0 18px 50px -12px rgba(0,102,255,0.45)",
      },
      backgroundImage: {
        "grid-slate":
          "linear-gradient(to right, rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.045) 1px, transparent 1px)",
        "hero-glow":
          "radial-gradient(58% 46% at 50% 0%, rgba(0,102,255,0.10) 0%, rgba(0,163,255,0.05) 42%, transparent 72%)",
      },
    },
  },
  plugins: [],
};

export default config;
