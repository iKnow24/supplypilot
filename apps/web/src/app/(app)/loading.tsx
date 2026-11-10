export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading…</span>
      <div className="bg-muted h-9 w-64 animate-pulse rounded-lg" />
      <div className="bg-muted h-4 w-96 max-w-full animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-muted h-28 animate-pulse rounded-2xl" />
        <div className="bg-muted h-28 animate-pulse rounded-2xl" />
        <div className="bg-muted h-28 animate-pulse rounded-2xl" />
      </div>
      <div className="bg-muted h-56 animate-pulse rounded-2xl" />
    </div>
  );
}
