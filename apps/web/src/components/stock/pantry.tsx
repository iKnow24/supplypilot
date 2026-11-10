import Link from "next/link";

import { ItemIcon, LevelSlider } from "@/components/stock/level";
import { daysLeftText, qty, STATUS } from "@/lib/stock/format";
import type { StockRow } from "@/lib/stock/load";
import { GROUPS, lookFor } from "@/lib/stock/look";
import { cn } from "@/lib/utils";

export interface DeliveryMark {
  /** Days from today to the planned delivery. */
  inDays: number;
  /** "Fri", "Tue"… */
  label: string;
}

/** One item: icon, name, days left, and a slider showing how far it lasts. */
export function PantryTile({ row, delivery }: { row: StockRow; delivery: DeliveryMark | null }) {
  return (
    <Link
      href={`/stock/${row.productId}`}
      className={cn(
        "bg-card shadow-card hover:shadow-raised flex h-full flex-col gap-3 rounded-2xl p-4 ring-1 transition-[box-shadow,translate] hover:-translate-y-0.5",
        row.status === "short" ? "ring-destructive/30" : "ring-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        <ItemIcon product={row.product} status={row.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.product.name}</p>
          <p className={cn("tabular text-[15px] font-semibold", STATUS[row.status].text)}>
            {daysLeftText(row.daysLeft, row.onHand)}
          </p>
        </div>
      </div>
      <LevelSlider
        daysLeft={row.daysLeft}
        status={row.status}
        deliveryInDays={delivery?.inDays ?? null}
        scale={false}
      />
      <p className="text-muted-foreground -mt-1 text-xs">
        {row.onHand === null ? "Not counted yet" : `${qty(row.onHand, row.unit)} on hand`}
        {row.suggested > 0 ? ` · order ${qty(row.suggested, row.unit)}` : ""}
      </p>
    </Link>
  );
}

/** Every tracked item, grouped by shelf, most urgent first in each group. */
export function Pantry({ rows, delivery }: { rows: StockRow[]; delivery: DeliveryMark | null }) {
  const groups = GROUPS.map((g) => ({
    name: g,
    rows: rows.filter((r) => lookFor(r.product).group === g),
  })).filter((g) => g.rows.length > 0);
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.name} aria-label={g.name}>
          <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.08em] uppercase">
            {g.name}
          </h3>
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.rows.map((row) => (
              <li key={row.productId}>
                <PantryTile row={row} delivery={delivery} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
