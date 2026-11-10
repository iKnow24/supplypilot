import { render, screen } from "@testing-library/react";
import { Package } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/suppliers/sup_kestrel" }));

import { EmptyState } from "../empty-state";
import { MobileTabBar, OrderTabs, TopNav, isActive } from "../nav-links";
import { SupplierCard } from "../supplier-card";
import type { SupplierSummary } from "@/lib/catalog/repository";

describe("navigation", () => {
  it("puts suppliers under Orders, and marks the Vendors tab", () => {
    render(<TopNav />);
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    render(<OrderTabs />);
    expect(screen.getByRole("link", { name: "Vendors" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the three primary destinations on mobile", () => {
    render(<MobileTabBar />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Home",
      "Stock",
      "Orders",
    ]);
  });

  it("Home is only active on /", () => {
    expect(isActive("/cart", "/")).toBe(false);
    expect(isActive("/", "/")).toBe(true);
  });
});

describe("EmptyState", () => {
  it("shows a heading and guidance", () => {
    render(
      <EmptyState icon={Package} title="No purchase orders yet">
        Approve a recommendation first.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "No purchase orders yet" })).toBeInTheDocument();
    expect(screen.getByText("Approve a recommendation first.")).toBeInTheDocument();
  });
});

describe("SupplierCard", () => {
  const supplier: SupplierSummary = {
    id: "sup_x",
    name: "Example Supply (Demo)",
    short_name: "Example",
    kind: "Produce",
    description: "",
    synthetic: true,
    policy: {
      zones: ["ORL-DT"],
      delivery_weekdays: [1, 3],
      cutoff_local_time: "14:00",
      lead_days: 1,
      delivery_window: { start: "06:00", end: "10:00" },
      min_order_cents: 0,
      delivery_fee_cents: 4500,
      free_delivery_threshold_cents: null,
    },
    offerCount: 12,
    servesZone: (z) => z === "ORL-DT",
    latestPriceUpdate: new Date("2026-11-02T13:00:00Z"),
    latestInventorySnapshot: null,
    flaggedOfferCount: 1,
  };

  it("labels demo data, zone coverage, minimum and data problems in plain English", () => {
    render(
      <SupplierCard
        supplier={supplier}
        zone="ORL-WP"
        zoneName="Winter Park"
        now={new Date("2026-11-05T14:00:00Z")}
      />,
    );
    expect(screen.getByText("Demo catalog")).toBeInTheDocument();
    expect(screen.getByText(/Not in Winter Park/)).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument(); // no order minimum
    expect(screen.getByText(/1 item need fresh data/)).toBeInTheDocument();
    expect(screen.getByText("Monday, Wednesday")).toHaveClass("sr-only"); // what screen readers hear
  });
});
