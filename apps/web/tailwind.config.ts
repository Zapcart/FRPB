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
        // 2026 glass system: light translucent tints painted OVER the white
        // canvas. Alpha-tuned so text still clears WCAG AA on the composite.
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.62)",
          soft: "rgba(255, 255, 255, 0.44)",
          strong: "rgba(255, 255, 255, 0.80)",
          tint: "rgba(240, 246, 255, 0.55)",
          border: "rgba(255, 255, 255, 0.70)",
          edge: "rgba(15, 23, 42, 0.08)",
        },
      },
      borderRadius: {
        // Extra-large glass radii (rounded-3xl also works, this is the named step).
        "4xl": "2rem",
        "5xl": "2.5rem",
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
        // Light-canvas glass elevation: soft cool-tinted drop + inner top highlight.
        "glass-light":
          "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.16), inset 0 1px 0 0 rgba(255,255,255,0.70)",
        "glass-light-hover":
          "0 2px 6px rgba(15,23,42,0.06), 0 24px 56px -18px rgba(15,23,42,0.22), inset 0 1px 0 0 rgba(255,255,255,0.85)",
        "glass-light-float":
          "0 24px 70px -20px rgba(15,23,42,0.30), 0 2px 8px rgba(15,23,42,0.06), inset 0 1px 0 0 rgba(255,255,255,0.90)",
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
        // Hero: soft radial ripple core (centre-anchored, fades to transparent).
        "hero-ripple":
          "radial-gradient(circle at 50% 38%, rgba(0,102,255,0.16) 0%, rgba(0,163,255,0.08) 34%, transparent 68%)",
        // 2026 light canvas: soft, airy aurora mesh painted behind frosted panels.
        "aurora-mesh":
          "radial-gradient(42% 38% at 12% 8%, rgba(0,102,255,0.16) 0%, transparent 62%), radial-gradient(46% 42% at 88% 4%, rgba(0,163,255,0.14) 0%, transparent 64%), radial-gradient(50% 46% at 72% 88%, rgba(139,92,246,0.12) 0%, transparent 66%), radial-gradient(40% 36% at 18% 92%, rgba(0,163,255,0.10) 0%, transparent 60%)",
        "canvas-mesh":
          "radial-gradient(60% 50% at 50% 0%, rgba(0,102,255,0.08) 0%, transparent 70%), radial-gradient(45% 40% at 80% 20%, rgba(0,163,255,0.07) 0%, transparent 65%)",
        // Light sheen sweep painted onto frosted panels / buttons.
        "glass-sheen-light":
          "linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.15) 42%, transparent 100%)",
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
        // Hero entrance: fade in while scaling up (zero layout shift — transform
        // + opacity only).
        "fade-scale": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Expanding radial ripple ring behind the hero copy. One-shot: the
        // final keyframe is held via `animation-fill-mode: forwards` so the ring
        // resolves to opacity 0 and never lingers/repaints (fixes the "ring
        // stays visible then pops out" glitch on first paint).
        ripple: {
          "0%": { transform: "scale(0.55)", opacity: "0.5" },
          "60%": { opacity: "0.12" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        // Gentle vertical bob for floating capability tags.
        "bounce-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-9px)" },
        },
        // Seamless horizontal loop for the trust-badge marquee (track is 2x).
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        // Slow rotation for the conic aurora bloom.
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // Diagonal light sheen sweeping across glass panels (subtle, long loop).
        sheen: {
          "0%": { transform: "translateX(-140%) skewX(-16deg)", opacity: "0" },
          "18%": { opacity: "0.85" },
          "100%": { transform: "translateX(220%) skewX(-16deg)", opacity: "0" },
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
        "fade-scale": "fade-scale 0.8s cubic-bezier(0.22,1,0.36,1) both",
        "fade-scale-slow": "fade-scale 1.1s cubic-bezier(0.22,1,0.36,1) both",
        ripple: "ripple 3s ease-out forwards",
        "bounce-slow": "bounce-slow 4.5s ease-in-out infinite",
        marquee: "marquee 34s linear infinite",
        "spin-slow": "spin-slow 28s linear infinite",
        sheen: "sheen 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
