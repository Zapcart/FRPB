// FRPB — Indian rupee formatting helper.
//
// Direct-UPI amounts are stored as whole rupees (1900 / 4900 / 9999), so this
// renders them with Indian digit grouping (₹1,900 / ₹9,999) and no decimals.

/** Format a whole-rupee amount as "₹1,900" using Indian digit grouping. */
export function formatInr(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}
