"use client";

import { Eraser, Save } from "lucide-react";
import { useState } from "react";

import { clearCart, saveCartAsList } from "@/app/(app)/cart/actions";
import { Button } from "@/components/ui/button";

import { useAction } from "./status";

export function CartToolbar({ defaultName, hasLines }: { defaultName: string; hasLines: boolean }) {
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [name, setName] = useState(defaultName);
  const { pending, run } = useAction();

  if (!hasLines) return null;

  if (saving) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveCartAsList(name),
            (r) => r.ok && setSaving(false),
          );
        }}
      >
        <label htmlFor="list-name" className="sr-only">
          List name
        </label>
        <input
          id="list-name"
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setSaving(false)}
          className="border-input bg-card h-10 w-56 rounded-lg border px-3 text-sm"
        />
        <Button type="submit" disabled={pending}>
          Save list
        </Button>
        <Button type="button" variant="ghost" onClick={() => setSaving(false)}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setSaving(true)}>
        <Save aria-hidden /> Save as list
      </Button>
      {confirmClear ? (
        <>
          <Button
            variant="outline"
            className="text-destructive"
            disabled={pending}
            onClick={() =>
              run(
                () => clearCart(),
                () => setConfirmClear(false),
              )
            }
          >
            Yes, clear cart
          </Button>
          <Button variant="ghost" onClick={() => setConfirmClear(false)}>
            Keep it
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setConfirmClear(true)}>
          <Eraser aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}
