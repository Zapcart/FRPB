// FRPB — 2026 glassmorphism primitives.
//
// Presentational, hook-free components so they can be rendered from both server
// and client components. Every primitive maps onto the light-canvas glass
// classes defined in globals.css, which ship with an `@supports` fallback and a
// mobile blur budget. Styling is composable: pass extra `className` to override.

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";

import { cn } from "./cn";

/* -------------------------------------------------------------------------- */
/* GlassCard                                                                   */
/* -------------------------------------------------------------------------- */

export interface GlassCardProps extends ComponentPropsWithoutRef<"div"> {
  /** Frosted fill strength. `soft` for inset blocks, `strong` for dense content. */
  tone?: "soft" | "default" | "strong";
  /** Enable the interactive lift-on-hover treatment. */
  interactive?: boolean;
}

type GlassCardTone = NonNullable<GlassCardProps["tone"]>;

const CARD_TONE: Record<GlassCardTone, string> = {
  soft: "glass-surface",
  default: "glass-panel",
  strong: "glass-panel-strong",
};

/**
 * Generic frosted card. Renders a translucent, blurred panel over the light
 * canvas. Use `interactive` for clickable/tappable cards.
 */
export const GlassCard = forwardRef<ElementRef<"div">, GlassCardProps>(
  function GlassCard(
    { tone = "default", interactive = false, className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          CARD_TONE[tone],
          interactive &&
            "transition duration-300 hover:-translate-y-0.5 hover:border-white/80 hover:shadow-glass-light-hover",
          className,
        )}
        {...props}
      />
    );
  },
);

/* -------------------------------------------------------------------------- */
/* GlassPanel                                                                  */
/* -------------------------------------------------------------------------- */

export interface GlassPanelProps extends ComponentPropsWithoutRef<"section"> {
  /** Marketing-style aurora mesh painted behind the panel content. */
  mesh?: boolean;
}

/**
 * Large frosted section container. Optionally paints the soft aurora mesh so a
 * hero/pricing band reads as a distinct glass surface.
 */
export const GlassPanel = forwardRef<ElementRef<"section">, GlassPanelProps>(
  function GlassPanel({ mesh = false, className, children, ...props }, ref) {
    return (
      <section
        ref={ref}
        className={cn("glass-panel-strong relative overflow-hidden", className)}
        {...props}
      >
        {mesh ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-aurora-mesh opacity-70"
          />
        ) : null}
        {children}
      </section>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* GlassSurface                                                                */
/* -------------------------------------------------------------------------- */

export type GlassSurfaceProps = ComponentPropsWithoutRef<"div">;

/** Low-key frosted surface for nested/inset blocks inside a panel. */
export const GlassSurface = forwardRef<ElementRef<"div">, GlassSurfaceProps>(
  function GlassSurface({ className, ...props }, ref) {
    return <div ref={ref} className={cn("glass-surface", className)} {...props} />;
  },
);

/* -------------------------------------------------------------------------- */
/* GlassButton                                                                 */
/* -------------------------------------------------------------------------- */

export interface GlassButtonProps
  extends ComponentPropsWithoutRef<"button"> {
  variant?: "glass" | "primary" | "accent";
  size?: "sm" | "md" | "lg";
}

type GlassButtonVariant = NonNullable<GlassButtonProps["variant"]>;
type GlassButtonSize = NonNullable<GlassButtonProps["size"]>;

const BUTTON_VARIANT: Record<GlassButtonVariant, string> = {
  glass:
    "border border-white/70 bg-white/60 text-ink shadow-glass-light backdrop-blur-xl hover:border-brand-200 hover:bg-white hover:text-brand-700",
  primary: "bg-brand-500 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600",
  accent:
    "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110",
};

const BUTTON_SIZE: Record<GlassButtonSize, string> = {
  sm: "min-h-[40px] rounded-xl px-4 py-2 text-xs",
  md: "min-h-[44px] rounded-xl px-5 py-2.5 text-sm",
  lg: "min-h-[52px] rounded-2xl px-8 py-3.5 text-sm",
};

/**
 * Glass-aware button. `glass` (default) is the frosted secondary CTA; the
 * `primary`/`accent` variants match the existing brand buttons.
 */
export const GlassButton = forwardRef<
  ElementRef<"button">,
  GlassButtonProps
>(function GlassButton(
  { variant = "glass", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex cursor-pointer touch-manipulation select-none items-center justify-center gap-2 font-semibold transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...props}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* GlassInput                                                                  */
/* -------------------------------------------------------------------------- */

export type GlassInputProps = ComponentPropsWithoutRef<"input">;

/** Frosted text input that lifts to solid white on focus. */
export const GlassInput = forwardRef<ElementRef<"input">, GlassInputProps>(
  function GlassInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn("glass-input", className)} {...props} />;
  },
);

/* -------------------------------------------------------------------------- */
/* GlassBadge                                                                  */
/* -------------------------------------------------------------------------- */

export interface GlassBadgeProps extends ComponentPropsWithoutRef<"span"> {
  tone?: "neutral" | "brand";
}

/** Small frosted pill used for tags, statuses and eyebrow labels. */
export const GlassBadge = forwardRef<ElementRef<"span">, GlassBadgeProps>(
  function GlassBadge({ tone = "neutral", className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur",
          tone === "brand"
            ? "border-brand-200/70 bg-brand-50/70 text-brand-700"
            : "border-glass-edge bg-glass-soft text-slate-600",
          className,
        )}
        {...props}
      />
    );
  },
);
