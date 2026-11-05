import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <div>
      <PageHeader
        title="Orders"
        description="Draft and exported purchase orders, split by supplier."
      />
      <EmptyState
        icon={Package}
        title="No purchase orders yet"
        action={
          <Button asChild>
            <Link href="/cart">Go to Smart Cart</Link>
          </Button>
        }
      >
        Orders are shown as <strong className="text-foreground font-medium">Draft</strong> or{" "}
        <strong className="text-foreground font-medium">Exported</strong>. SupplyPilot never sends
        orders to suppliers or charges you; you export the PO and send it yourself.
      </EmptyState>
    </div>
  );
}
