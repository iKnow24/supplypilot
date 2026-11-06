"use client";

import { ClipboardCheck, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { approveResult, reorder } from "@/app/orders/actions";
import { useAction } from "@/components/cart/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";

export interface ExistingPo {
  id: string;
  number: string;
  supplierName: string;
  totalCents: number;
  status: "draft" | "exported";
}

/**
 * The explicit approve step. Before: what will be created. After: the POs, with links.
 * Nothing is ever sent to a supplier from here.
 */
export function ApproveResult({
  runId,
  suppliers,
  existing,
  partialNote,
}: {
  runId: string;
  suppliers: { name: string; totalCents: number }[];
  existing: ExistingPo[];
  partialNote: string | null;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (existing.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="text-success size-5" aria-hidden /> Purchase orders
          </CardTitle>
          <CardDescription>Download each one and send it to the supplier yourself.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y text-sm">
            {existing.map((po) => (
              <li key={po.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/orders/${po.id}`} className="font-medium hover:underline">
                  {po.number} · {po.supplierName}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="tabular">{formatCents(po.totalCents)}</span>
                  <Badge variant={po.status === "exported" ? "success" : "neutral"}>
                    {po.status === "exported" ? "Exported" : "Draft"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                () => reorder({ runId }),
                (r) => r.ok && r.href && router.push(r.href),
              )
            }
          >
            <RotateCcw aria-hidden /> Reorder all into cart
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Happy with this plan?</CardTitle>
        <CardDescription>
          Approving creates a draft purchase order for each supplier. Nothing is sent to anyone: you
          download the POs and send them yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {confirming ? (
          <>
            <ul className="space-y-1 text-sm">
              {suppliers.map((s) => (
                <li key={s.name} className="flex justify-between gap-4">
                  <span>{s.name}</span>
                  <span className="tabular">{formatCents(s.totalCents)}</span>
                </li>
              ))}
            </ul>
            {partialNote ? <p className="text-warning text-xs">{partialNote}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => approveResult(runId),
                    () => setConfirming(false),
                  )
                }
              >
                Create {suppliers.length} draft PO{suppliers.length === 1 ? "" : "s"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </div>
          </>
        ) : (
          <Button size="lg" className="w-full" onClick={() => setConfirming(true)}>
            <ClipboardCheck aria-hidden /> Approve plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
