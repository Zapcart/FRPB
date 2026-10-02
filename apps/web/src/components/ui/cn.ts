// FRPB — minimal, dependency-free class-name joiner for the UI primitives.
// Filters out falsy values so callers can inline conditionals safely.

export type ClassValue = string | number | null | undefined | false;

/**
 * Join truthy class values into a single space-separated string.
 *
 * `cn("glass-panel", isActive && "ring-2", undefined)` -> `"glass-panel ring-2"`
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

export default cn;
