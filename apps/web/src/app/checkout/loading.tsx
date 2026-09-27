// FRPB — checkout page loading state.
// Shown while the page is loading or React is hydrating on low-end mobile.
// Gives immediate visual feedback so the user knows the page is working, not
// frozen — reduces premature/repeated taps on the Pay button.

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm text-slate-500">Loading checkout…</p>
      </div>
    </div>
  );
}
