# Demo script (about 10 minutes)

Everything runs on synthetic data: three fictional Orlando buyers, five fictional suppliers, and a
fixed demo clock of **Thursday Nov 5, 2026, 9:00 AM Orlando**, so dates and totals below are
exact and repeatable. Start from a fresh database (`make db-reset`) and `make dev`.

Start on the landing page (`/`) and press **Open the live demo**; the app lives at `/home`.
Switch buyers with the "Ordering for" selector in the sidebar (the top bar on phones). Each one is signed in as its own demo account, so
they never see each other's carts, lists, results or orders.

---

## 1. "One list" — the buyer's habit (Sunday Crumb Bakery)

1. **Home**: the demo banner, the saved "Weekly bake order", at-a-glance stats, and when each
   supplier can next deliver.
2. **Lists → Load into cart**: 14 items, each marked "usually from Bramblewood / Meadowlark /
   Citrus Row". That habit is the baseline every saving is measured against.
3. **Edit in the cart**: press `/` to search, type "vanilla", ↑/↓ and Enter to add. Focus jumps to
   the quantity. Typing `0` explains the error, and nothing is saved.
4. **Delivery date**: pick **Tue, Nov 10**. Kestrel "doesn't deliver on Tuesdays (delivers Mon, Wed,
   Fri)", and Pelican "does not deliver to your area".

## 2. Honest results, even when the order can't be filled exactly

5. **Find My Best Price** gives **$1,316.33 for 13 of 14 items**.
   - Strawberries are left out, with the reason: Citrus Row's $75 minimum can't be reached with
     16 lb, and no one else sells them on Tuesday.
   - "Your usual suppliers are already the cheapest for this order." We don't invent savings.
   - Bramblewood's delivery is free because the order passes its $500 threshold.
   - "Pack sizes round Pure vanilla extract up to 128 fl oz."

## 3. The core idea: cheapest items ≠ cheapest delivered basket (Third Shift Coffee)

Switch to **Third Shift Coffee**. On the cart, **Upload a CSV**:

```csv
product,quantity,unit
prd_milk_whole,16,gal
prd_oat_milk,12,qt
```

Pick **Wed, Nov 11**, then **Find My Best Price**: **$132.60 from Meadowlark**.
- Pelican has the lowest per-item prices, but its $45 delivery fee makes it $18.30 more delivered.
- The alternatives table shows "Lowest item prices: $150.90 (+$18.30)" with the trade-off in words.

## 4. The delivery day changes the answer

Same buyer, CSV:

```csv
product,quantity,unit
prd_cup_hot_12,2000,each
prd_lid_hot_12,2000,each
prd_cup_cold_16,1000,each
prd_napkins,6000,each
```

- **Sat, Nov 14**: only Pelican delivers, so **$541.60**.
- Change the date to **Wed, Nov 11** and run again: Kestrel delivers, clears its minimum, and is
  cheaper at **$489.30**. Both runs are kept under **Past results**.

## 5. Stale data is never used

Same buyer, **Wed, Nov 11**, CSV:

```csv
product,quantity,unit
prd_coffee_espresso,10,lb
prd_blueberries,9,lb
prd_cup_hot_12,2000,each
prd_lid_hot_12,2000,each
```

**$450.30 from Kestrel.** The plan says it left out Pelican's espresso (price 38 days old, limit
14) and Citrus Row's blueberries (stock count 75 hours old, limit 36). "We never use out-of-date
prices or stock."

## 6. From plan to purchase orders

7. On that result, **Approve plan** shows what will be created. Then **Create 1 draft PO**.
8. Open the PO: SKUs, packs, pack prices, the cutoff ("Order by Tue, Nov 10, 2 PM").
9. **Download PDF**: a real purchase order, and the PO flips to **Exported**. SupplyPilot never
   sends anything to a supplier.
10. **Reorder** puts the same packs back in the cart, now "usually from Kestrel", so next week's
    run shows savings against this order.

---

### More scenarios (CSV + date)

| Scenario | Buyer | Date | Result |
| --- | --- | --- | --- |
| Bundling beats the cheaper butter | Sunday Crumb | Tue Nov 10 | $536.95, all Bramblewood, free delivery |
| Stock forces a split (`prd_butter_unsalted,288,lb`) | Sunday Crumb | Tue Nov 10 | $1,273.80, 4 cases each from Bramblewood + Meadowlark |
| Minimum rules out the cheap supplier | Little Juniper | Mon Nov 9 | $113.70 from Citrus Row; Kestrel's $400 minimum explained |
| Pack sizes normalized (`prd_eggs_large,360,each` + `prd_cream_heavy,12,qt`) | Little Juniper | Wed Nov 11 | $175.90, eggs as 2 × 15-dozen cases |
| No one delivers Sunday | any | Sun Nov 8 | The date picker shows "—" and explains each supplier's days |

CSVs for the bundling scenario:

```csv
product,quantity,unit
prd_flour_ap_unbl,250,lb
prd_sugar_gran_cane,50,lb
prd_butter_unsalted,36,lb
prd_box_pastry_10,200,each
prd_choc_chips,25,lb
```

and the minimum scenario:

```csv
product,quantity,unit
prd_onion_yellow,100,lb
prd_tomato_roma,25,lb
```

### If something looks off

- "Your sign-in expired and couldn't be renewed" means the Docker VM clock drifted after the Mac
  slept. Run `make db-doctor`, then quit and reopen OrbStack.
- "The price optimizer isn't reachable" means the optimizer isn't running (`make dev` starts both).
