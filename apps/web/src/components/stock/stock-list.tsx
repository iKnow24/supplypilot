import Link from "next/link";

import { CountEditor } from "@/components/stock/count-editor";
import { UsageBars } from "@/components/stock/sparkline";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTime, localParts } from "@/lib/delivery";
import { qty, STATUS } from "@/lib/stock/format";
import type { StockRow } from "@/lib/stock/load";
import { daysBetween } from "@/lib/stock/plan";
import { unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

export function OnHand({ row, now, timeZone }: { row: StockRow; now: Date; timeZone: string }) {
  if (row.onHand === null) return <span className="text-muted-foreground">Not counted</span>;
  const count = row.count;
  // The demo runs on a fixed clock, so a count saved today is "newer" than the demo's now.
  const justNow = count && count.countedAt >= now;
  const counted = count && !justNow ? localParts(count.countedAt, timeZone) : null;
  return (
    <div>
      <p className="tabular font-medium">{qty(row.onHand, row.unit)}</p>
      {justNow ? (
        <p className="text-muted-foreground text-xs">Just counted</p>
      ) : counted && count ? (
        <p className="text-muted-foreground text-xs">
          Counted {qty(count.quantity, row.unit)}, {formatDate(counted.date)}{" "}
          {formatTime(counted.time)}
        </p>
      ) : null}
    </div>
  );
}

export function Burn({ row }: { row: StockRow }) {
  const pct = row.trend === null ? 0 : Math.round(row.trend * 100);
  return (
    <div className="flex items-center gap-3">
      <UsageBars values={row.history} />
      <div>
        <p className="tabular font-medium">{qty(row.weekly, row.unit)}/wk</p>
        {Math.abs(pct) >= 5 ? (
          <p className={cn("text-xs", pct > 0 ? "text-warning" : "text-muted-foreground")}>
            {pct > 0 ? "Up" : "Down"} {Math.abs(pct)}% vs the month before
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">Steady</p>
        )}
      </div>
    </div>
  );
}

export function RunsOut({ row, today }: { row: StockRow; today: string }) {
  if (!row.runsOutOn) return <span className="text-muted-foreground">—</span>;
  const days = daysBetween(today, row.runsOutOn);
  return (
    <div>
      <p className={cn("tabular font-medium", row.status === "short" && "text-destructive")}>
        {formatDate(row.runsOutOn)}
      </p>
      <p className="text-muted-foreground text-xs">
        {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
      </p>
    </div>
  );
}

export function Suggested({ row }: { row: StockRow }) {
  if (row.status === "unknown")
    return <span className="text-muted-foreground">Count it first</span>;
  if (row.suggested === 0) return <span className="text-muted-foreground">Skip this time</span>;
  return <span className="tabular font-semibold">{qty(row.suggested, row.unit)}</span>;
}

/** The detailed view: a table on tablets and up, cards on phones. */
export function StockList({
  rows,
  now,
  timeZone,
  today,
}: {
  rows: StockRow[];
  now: Date;
  timeZone: string;
  today: string;
}) {
  return (
    <>
      <div className="bg-card shadow-card hidden overflow-hidden rounded-2xl md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Item</TableHead>
              <TableHead>On hand now</TableHead>
              <TableHead>Weekly use</TableHead>
              <TableHead>Runs out</TableHead>
              <TableHead>Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.productId} className="align-top">
                <TableCell className="py-3">
                  <Link
                    href={`/stock/${row.productId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {row.product.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
                    <CountEditor
                      productId={row.productId}
                      productName={row.product.name}
                      unitLabel={unitShortLabel(row.unit)}
                    />
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <OnHand row={row} now={now} timeZone={timeZone} />
                </TableCell>
                <TableCell className="py-3">
                  <Burn row={row} />
                </TableCell>
                <TableCell className="py-3">
                  <RunsOut row={row} today={today} />
                </TableCell>
                <TableCell className="py-3">
                  <Suggested row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.productId} className="bg-card shadow-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/stock/${row.productId}`} className="font-medium">
                {row.product.name}
              </Link>
              <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">On hand now</dt>
                <dd>
                  <OnHand row={row} now={now} timeZone={timeZone} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Order</dt>
                <dd>
                  <Suggested row={row} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Weekly use</dt>
                <dd>
                  <Burn row={row} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Runs out</dt>
                <dd>
                  <RunsOut row={row} today={today} />
                </dd>
              </div>
            </dl>
            <div className="mt-2">
              <CountEditor
                productId={row.productId}
                productName={row.product.name}
                unitLabel={unitShortLabel(row.unit)}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
