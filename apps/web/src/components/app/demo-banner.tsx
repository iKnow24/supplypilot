import { FlaskConical } from "lucide-react";

export function DemoBanner({ label }: { label: string }) {
  return (
    <div role="note" className="bg-warning-soft text-warning border-b">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium sm:px-6">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <span>{label}. Fictional suppliers and buyers. No real orders are placed.</span>
      </p>
    </div>
  );
}
