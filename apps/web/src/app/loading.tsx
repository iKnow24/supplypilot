export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="bg-muted h-9 w-56 animate-pulse rounded-lg" />
      <div className="bg-muted h-40 animate-pulse rounded-xl" />
    </div>
  );
}
