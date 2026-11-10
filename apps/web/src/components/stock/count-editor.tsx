"use client";

import { ClipboardPen } from "lucide-react";
import { useId, useState } from "react";

import { recordStockCount } from "@/app/(app)/stock/actions";
import { useAction } from "@/components/cart/status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Update count": record what's on the shelf right now. */
export function CountEditor({
  productId,
  productName,
  unitLabel,
}: {
  productId: string;
  productName: string;
  unitLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAction();
  const errorId = useId();

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="-ml-2"
        onClick={() => setOpen(true)}
      >
        <ClipboardPen aria-hidden /> Update count
        <span className="sr-only"> for {productName}</span>
      </Button>
    );
  }

  const save = () =>
    run(
      () => recordStockCount(productId, value),
      (r) => {
        if (r.ok) {
          setOpen(false);
          setValue("");
        } else setError(r.error);
      },
    );

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="sr-only" htmlFor={`${errorId}-input`}>
        How much {productName} do you have now, in {unitLabel}?
      </label>
      <span className="relative">
        <input
          autoFocus
          id={`${errorId}-input`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className={cn(
            "border-input bg-card tabular h-8 w-28 rounded-lg border pr-12 pl-2.5 text-right text-sm",
            error && "border-destructive",
          )}
        />
        <span
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
        >
          {unitLabel}
        </span>
      </span>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error ? (
        <p id={errorId} className="text-destructive w-full text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}
