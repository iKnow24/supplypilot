import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Past results" };

export default async function ResultsPage() {
  const { persistence, state } = await getSession();
  const source = await getRepository().source();
  const runs = state ? await state.listRuns(50) : [];

  return (
    <div>
      <PageHeader
        title="Past results"
        description="Every Find My Best Price run, exactly as it was calculated."
        actions={
          <Button asChild variant="outline">
            <Link href="/cart">Go to cart</Link>
          </Button>
        }
      />
      {!state ? (
        <PersistenceNotice persistence={persistence} />
      ) : runs.length === 0 ? (
        <EmptyState icon={History} title="No results yet">
          Build your cart, pick a delivery date and choose Find My Best Price.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-2 pt-2 sm:px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Calculated</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link href={`/results/${run.id}`} className="font-medium hover:underline">
                        {run.createdAt.toLocaleString("en-US", {
                          timeZone: source.timezone,
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {run.lineCount} items
                        {run.supplierCount ? ` · ${run.supplierCount} suppliers` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="tabular">{formatDate(run.deliveryDate)}</TableCell>
                    <TableCell className="tabular text-right">
                      {run.totalCents !== null ? (
                        <>
                          {formatCents(run.totalCents)}
                          {run.status === "partial" ? (
                            <Badge variant="warning" className="ml-2">
                              Partial
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        <Badge variant="destructive">Not possible</Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular hidden text-right sm:table-cell">
                      {run.savingsCents && run.savingsCents > 0 ? (
                        <span className="text-success">{formatCents(run.savingsCents)}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
