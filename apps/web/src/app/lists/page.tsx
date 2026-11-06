import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { SavedListCard } from "@/components/cart/saved-list-card";
import { StatusProvider } from "@/components/cart/status";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession } from "@/lib/session";
import { UnitTable } from "@/lib/units";
import { baselineSuppliers } from "@/lib/view";

export const metadata: Metadata = { title: "Saved lists" };

export default async function ListsPage() {
  const repo = getRepository();
  const { persistence, state } = await getSession();
  const [products, suppliers, units] = await Promise.all([
    repo.listProducts(),
    repo.listSuppliers(),
    repo.units(),
  ]);
  const lists = state ? await state.listSavedLists() : [];
  const names = new Map(products.map((p) => [p.id, p.name]));
  const table = new UnitTable(units);

  return (
    <StatusProvider>
      <PageHeader
        title="Saved lists"
        description="Your usual orders. Load one into the Smart Cart, or copy it to make a variation."
      />
      {!state ? (
        <PersistenceNotice persistence={persistence} />
      ) : lists.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No saved lists yet">
          Build a cart, then choose “Save as list” to reorder it in one click next week.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {lists.map((list) => (
            <li key={list.id}>
              <SavedListCard
                list={{
                  id: list.id,
                  name: list.name,
                  updatedAt: list.updatedAt.toISOString(),
                  itemCount: list.lines.length,
                  suppliers: baselineSuppliers(list, suppliers),
                  preview: list.lines.slice(0, 6).map((l) => ({
                    name: names.get(l.product_id) ?? l.product_id,
                    amount: `${Number(l.quantity).toLocaleString("en-US")} ${
                      table.get(l.unit).code === "each" ? "" : l.unit.replace("_", " ")
                    }`.trim(),
                  })),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </StatusProvider>
  );
}
