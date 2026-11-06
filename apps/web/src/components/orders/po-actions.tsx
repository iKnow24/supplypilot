"use client";

import { Download, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { discardDraftPurchaseOrder, exportPurchaseOrder, reorder } from "@/app/orders/actions";
import { useAction } from "@/components/cart/status";
import { Button } from "@/components/ui/button";

/** Export (marks Exported, then downloads), reorder into the cart, discard a draft. */
export function PurchaseOrderActions({ poId, isDraft }: { poId: string; isDraft: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [confirm, setConfirm] = useState<"reorder" | "discard" | null>(null);

  const download = (format: "csv" | "pdf") =>
    run(
      () => exportPurchaseOrder(poId),
      (r) => {
        if (!r.ok) return;
        // A download, not a navigation: the page stays put and refreshes its status.
        const a = document.createElement("a");
        a.href = `/orders/${poId}/export?format=${format}`;
        a.download = "";
        a.click();
        router.refresh();
      },
    );

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => download("pdf")} disabled={pending}>
        <Download aria-hidden /> Download PDF
      </Button>
      <Button variant="outline" onClick={() => download("csv")} disabled={pending}>
        <Download aria-hidden /> Download CSV
      </Button>
      {confirm === "reorder" ? (
        <>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => reorder({ poId }),
                (r) => r.ok && r.href && router.push(r.href),
              )
            }
          >
            Yes, replace my cart
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setConfirm("reorder")}>
          <RotateCcw aria-hidden /> Reorder
        </Button>
      )}
      {isDraft ? (
        confirm === "discard" ? (
          <>
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () => discardDraftPurchaseOrder(poId),
                  (r) => r.ok && r.href && router.push(r.href),
                )
              }
            >
              Yes, discard this draft
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm("discard")}>
            <Trash2 aria-hidden /> Discard draft
          </Button>
        )
      ) : null}
    </div>
  );
}
