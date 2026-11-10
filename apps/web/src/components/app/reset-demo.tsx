"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { resetDemoBusiness } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

function Confirm({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <RotateCcw aria-hidden /> {pending ? "Resetting…" : `Yes, reset ${name}`}
    </Button>
  );
}

/** Two taps on purpose: it wipes this demo business's carts, results and purchase orders. */
export function ResetDemo({ name }: { name: string }) {
  const [sure, setSure] = useState(false);
  if (!sure) {
    return (
      <Button type="button" variant="outline" onClick={() => setSure(true)}>
        <RotateCcw aria-hidden /> Reset demo
      </Button>
    );
  }
  return (
    <form action={resetDemoBusiness} className="flex flex-wrap items-center gap-2">
      <Confirm name={name} />
      <Button type="button" variant="ghost" onClick={() => setSure(false)}>
        Cancel
      </Button>
    </form>
  );
}
