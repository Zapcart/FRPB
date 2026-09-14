import type { Config } from "tailwindcss";

/**
 * FRPB design tokens.
 *
 * Dark SaaS system (landing / marketing surfaces)
 *   Void   -> #09090b (page background)
 *   Surface-> #0c0c0e (raised panels)
 *   Glass  -> translucent white overlays + backdrop-blur
 *
 * Brand system (light surfaces: pricing, dashboard, auth)
 *   Primary -> Deep Electric Blue #0066FF (brand)
 *   Accent  -> Vibrant Cyan #00A3FF (CTAs, gradients)
 *   Ink     -> Slate #0F172A (headlines / dark surfaces)
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
        // Dark SaaS surface scale.
        night: {
          950: "#09090b",
          900: "#0c0c0e",
          850: "#101014",
          800: "#15151a",
          700: "#1d1d23",
          600: "#26262e",
        },
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
        // Light surfaces.
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
        "card-hover": "0 2px 4px rgba(15,23,42,0.05), 0 20px 44px rgba(15,23,42,0.10)",
        glow: "0 0 0 1px rgba(0,102,255,0.08), 0 8px 30px rgba(0,102,255,0.18)",
        "blue-glow": "0 18px 50px -12px rgba(0,102,255,0.45)",
        // Dark glassmorphism surfaces.
        glass:
          "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.6), 0 24px 60px -20px rgba(0,0,0,0.85)",
        "glass-hover":
          "inset 0 1px 0 0 rgba(255,255,255,0.10), 0 1px 2px rgba(0,0,0,0.6), 0 34px 80px -24px rgba(0,0,0,0.95)",
        // Neon accents.
        "glow-sm": "0 0 0 1px rgba(0,102,255,0.28), 0 0 24px -4px rgba(0,102,255,0.55)",
        "glow-lg": "0 0 0 1px rgba(0,163,255,0.35), 0 0 70px -12px rgba(0,102,255,0.75)",
        "cyan-glow": "0 20px 60px -18px rgba(0,163,255,0.6)",
      },
      backgroundImage: {
        // Light surfaces (kept for pricing/dashboard parity).
        "grid-slate":
          "linear-gradient(to right, rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.045) 1px, transparent 1px)",
        "hero-glow":
          "radial-gradient(58% 46% at 50% 0%, rgba(0,102,255,0.10) 0%, rgba(0,163,255,0.05) 42%, transparent 72%)",
        // Dark marketing surfaces.
        "grid-dark":
          "linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)",
        "grid-dark-sm":
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
        "hero-aurora":
          "radial-gradient(60% 50% at 50% 0%, rgba(0,102,255,0.28) 0%, rgba(0,163,255,0.12) 40%, transparent 72%)",
        "conic-brand":
          "conic-gradient(from 210deg at 50% 50%, rgba(0,102,255,0.85), rgba(0,163,255,0.85), rgba(139,92,246,0.85), rgba(0,102,255,0.85))",
        "glass-sheen":
          "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 45%, transparent 100%)",
      },
      backgroundSize: {
        "grid-60": "60px 60px",
        "grid-32": "32px 32px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        aurora: {
          "0%": { transform: "translate3d(0,0,0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate3d(4%,-3%,0) scale(1.12)", opacity: "0.8" },
          "100%": { transform: "translate3d(-3%,2%,0) scale(1.04)", opacity: "0.6" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.04)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "grid-pan": {
          "0%": { backgroundPosition: "0px 0px" },
          "100%": { backgroundPosition: "60px 60px" },
        },
        shine: {
          "0%": { transform: "translateX(-120%) skewX(-18deg)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translateX(240%) skewX(-18deg)", opacity: "0" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite alternate",
        "pulse-glow": "pulse-glow 5s ease-in-out infinite",
        "gradient-pan": "gradient-pan 6s ease infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both",
        "grid-pan": "grid-pan 24s linear infinite",
        shine: "shine 1s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
