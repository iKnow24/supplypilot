"""Generate the SupplyPilot synthetic demo catalog.

Run:  python3 data/seed/generate_seed.py
Writes: data/seed/demo_catalog.json

EVERYTHING in this file is invented demo data. No supplier, buyer, price,
stock level or delivery schedule here describes a real business. The output
is labelled `synthetic: true` at every level so the app can never present it
as live pricing.

Why a generator instead of hand-written JSON?
  * The offers table below is far easier to read and review than 150 JSON
    objects, and the JSON is always regenerated the same way (deterministic,
    no randomness, no wall-clock time).
  * Both the web app (TypeScript) and the optimizer (Python) read the same
    generated JSON, so there is exactly one source of truth.

Quantities are exact decimal strings ("50", "0.5") plus a unit code. The
units table gives exact conversion factors to a base unit (g, ml, each), so
the optimizer can do exact arithmetic with fractions instead of floats.
"""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).with_name("demo_catalog.json")

# Fixed "demo clock". Freshness (stale price / stale stock) is judged against
# this instant whenever the dataset is synthetic, so the demo behaves the same
# on any day you run it. Thursday, Nov 5 2026, 9:00 AM Orlando time.
REFERENCE_NOW = "2026-11-05T09:00:00-05:00"
IMPORT_ID = "imp_demo_seed_v1"

UNITS = [
    # code, label, dimension, base unit, exact factor to base unit
    ("g", "gram", "mass", "g", "1"),
    ("kg", "kilogram", "mass", "g", "1000"),
    ("lb", "pound", "mass", "g", "453.59237"),
    ("oz", "ounce", "mass", "g", "28.349523125"),
    ("ml", "milliliter", "volume", "ml", "1"),
    ("l", "liter", "volume", "ml", "1000"),
    ("fl_oz", "fluid ounce", "volume", "ml", "29.5735295625"),
    ("pt", "pint", "volume", "ml", "473.176473"),
    ("qt", "quart", "volume", "ml", "946.352946"),
    ("gal", "gallon", "volume", "ml", "3785.411784"),
    ("each", "each", "count", "each", "1"),
    ("dozen", "dozen", "count", "each", "12"),
]

ZONES = [
    ("ORL-DT", "Downtown Orlando"),
    ("ORL-WP", "Winter Park"),
    ("ORL-UCF", "East Orlando / UCF"),
    ("ORL-KIS", "Kissimmee"),
]

# Weekdays use ISO numbering: 1 = Monday ... 7 = Sunday.
SUPPLIERS = [
    {
        "id": "sup_kestrel",
        "name": "Kestrel Foodservice (Demo)",
        "short_name": "Kestrel",
        "kind": "Broadline distributor",
        "description": "Large broadline catalog with low per-unit prices and a high order minimum.",
        "policy": {
            "zones": ["ORL-DT", "ORL-WP", "ORL-UCF", "ORL-KIS"],
            "delivery_weekdays": [1, 3, 5],
            "cutoff_local_time": "14:00",
            "lead_days": 1,
            "delivery_window": {"start": "06:00", "end": "10:00"},
            "min_order_cents": 40000,
            "delivery_fee_cents": 3500,
            "free_delivery_threshold_cents": 75000,
        },
    },
    {
        "id": "sup_bramblewood",
        "name": "Bramblewood Baking Supply (Demo)",
        "short_name": "Bramblewood",
        "kind": "Bakery specialist",
        "description": "Flour, sugar, butter, chocolate and bakery packaging.",
        "policy": {
            "zones": ["ORL-DT", "ORL-WP", "ORL-UCF"],
            "delivery_weekdays": [2, 4, 6],
            "cutoff_local_time": "12:00",
            "lead_days": 1,
            "delivery_window": {"start": "07:00", "end": "11:00"},
            "min_order_cents": 25000,
            "delivery_fee_cents": 2500,
            "free_delivery_threshold_cents": 50000,
        },
    },
    {
        "id": "sup_meadowlark",
        "name": "Meadowlark Dairy Co-op (Demo)",
        "short_name": "Meadowlark",
        "kind": "Dairy and eggs",
        "description": "Milk, cream, butter, cheese and eggs, delivered six days a week.",
        "policy": {
            "zones": ["ORL-DT", "ORL-WP", "ORL-UCF", "ORL-KIS"],
            "delivery_weekdays": [1, 2, 3, 4, 5, 6],
            "cutoff_local_time": "18:00",
            "lead_days": 1,
            "delivery_window": {"start": "05:00", "end": "08:00"},
            "min_order_cents": 10000,
            "delivery_fee_cents": 1500,
            "free_delivery_threshold_cents": None,
        },
    },
    {
        "id": "sup_citrusrow",
        "name": "Citrus Row Produce (Demo)",
        "short_name": "Citrus Row",
        "kind": "Produce",
        "description": "Fruit, vegetables and herbs. Limited stock on berries.",
        "policy": {
            "zones": ["ORL-DT", "ORL-WP", "ORL-UCF"],
            "delivery_weekdays": [1, 2, 3, 4, 5],
            "cutoff_local_time": "16:00",
            "lead_days": 1,
            "delivery_window": {"start": "06:00", "end": "09:00"},
            "min_order_cents": 7500,
            "delivery_fee_cents": 2000,
            "free_delivery_threshold_cents": 20000,
        },
    },
    {
        "id": "sup_pelican",
        "name": "Pelican Wholesale Club (Demo)",
        "short_name": "Pelican",
        "kind": "Cash-and-carry wholesaler",
        "description": "Some of the lowest shelf prices, no minimum, but a flat delivery fee and only two delivery days.",
        "policy": {
            "zones": ["ORL-DT", "ORL-UCF", "ORL-KIS"],
            "delivery_weekdays": [3, 6],
            "cutoff_local_time": "20:00",
            "lead_days": 1,
            "delivery_window": {"start": "10:00", "end": "14:00"},
            "min_order_cents": 0,
            "delivery_fee_cents": 4500,
            "free_delivery_threshold_cents": None,
        },
    },
]

# Canonical products: what a buyer asks for. Supplier items map onto these.
# (id, name, category, base_unit, default buyer unit, spec)
PRODUCTS = [
    # Flour & grains
    ("prd_flour_ap_unbl", "All-purpose flour, unbleached", "Flour & grains", "g", "lb", "Unbleached, unbromated, ~11.7% protein"),
    ("prd_flour_ap_bl", "All-purpose flour, bleached", "Flour & grains", "g", "lb", "Bleached, ~11% protein"),
    ("prd_flour_bread", "Bread flour, high-gluten", "Flour & grains", "g", "lb", "Unbleached, ~13.5% protein"),
    ("prd_flour_cake", "Cake flour", "Flour & grains", "g", "lb", "Bleached, ~8% protein"),
    ("prd_flour_ww", "Whole wheat flour", "Flour & grains", "g", "lb", "Stone-ground, hard red"),
    ("prd_flour_almond", "Almond flour, blanched", "Flour & grains", "g", "lb", "Super-fine, blanched"),
    ("prd_oats_rolled", "Rolled oats", "Flour & grains", "g", "lb", "Old-fashioned"),
    ("prd_rice_jasmine", "Jasmine rice", "Flour & grains", "g", "lb", "Long grain"),
    ("prd_pasta_penne", "Penne rigate", "Flour & grains", "g", "lb", "Durum semolina, dry"),
    # Sugar & sweeteners
    ("prd_sugar_gran_cane", "Granulated sugar, cane", "Sugar & sweeteners", "g", "lb", "Pure cane, extra fine"),
    ("prd_sugar_gran_beet", "Granulated sugar, beet", "Sugar & sweeteners", "g", "lb", "Beet sugar, extra fine"),
    ("prd_sugar_powdered", "Powdered sugar 10X", "Sugar & sweeteners", "g", "lb", "10X confectioners"),
    ("prd_sugar_brown_light", "Light brown sugar", "Sugar & sweeteners", "g", "lb", "Light brown"),
    ("prd_honey", "Clover honey", "Sugar & sweeteners", "g", "lb", "Pure clover honey"),
    # Eggs
    ("prd_eggs_large", "Large eggs, shell", "Eggs", "each", "dozen", "Grade A large, white"),
    # Dairy
    ("prd_butter_unsalted", "Unsalted butter, AA", "Dairy", "g", "lb", "Grade AA, 80% butterfat"),
    ("prd_butter_salted", "Salted butter, AA", "Dairy", "g", "lb", "Grade AA, 80% butterfat"),
    ("prd_butter_euro", "European-style butter, 82%", "Dairy", "g", "lb", "Cultured, 82% butterfat"),
    ("prd_milk_whole", "Whole milk", "Dairy", "ml", "gal", "Vitamin D, 3.25%"),
    ("prd_cream_heavy", "Heavy cream, 36%", "Dairy", "ml", "qt", "36% butterfat"),
    ("prd_half_half", "Half and half", "Dairy", "ml", "qt", "10.5% butterfat"),
    ("prd_oat_milk", "Oat milk, barista", "Dairy", "ml", "qt", "Barista edition"),
    ("prd_cream_cheese", "Cream cheese", "Dairy", "g", "lb", "Full fat, loaf"),
    ("prd_parmesan", "Parmesan, grated", "Dairy", "g", "lb", "Domestic, grated"),
    ("prd_mozz_shred", "Mozzarella, shredded", "Dairy", "g", "lb", "Low-moisture, part-skim"),
    # Coffee & tea
    ("prd_coffee_espresso", "Espresso beans, dark roast", "Coffee & tea", "g", "lb", "Whole bean"),
    ("prd_coffee_drip", "House drip coffee, medium roast", "Coffee & tea", "g", "lb", "Whole bean"),
    ("prd_coffee_decaf", "Decaf coffee", "Coffee & tea", "g", "lb", "Swiss water, whole bean"),
    ("prd_tea_chai", "Chai concentrate", "Coffee & tea", "ml", "qt", "Spiced, 1:1 concentrate"),
    # Produce
    ("prd_lemons", "Lemons", "Produce", "each", "each", "115-count size"),
    ("prd_limes", "Limes", "Produce", "each", "each", "200-count size"),
    ("prd_strawberries", "Strawberries", "Produce", "g", "lb", "US #1"),
    ("prd_blueberries", "Blueberries", "Produce", "g", "lb", "US #1"),
    ("prd_bananas", "Bananas", "Produce", "g", "lb", "Stage 4"),
    ("prd_onion_yellow", "Yellow onions", "Produce", "g", "lb", "Jumbo"),
    ("prd_tomato_roma", "Roma tomatoes", "Produce", "g", "lb", "Medium"),
    ("prd_romaine", "Romaine hearts", "Produce", "each", "each", "Hearts"),
    ("prd_garlic_peeled", "Garlic, peeled", "Produce", "g", "lb", "Whole peeled cloves"),
    ("prd_avocado", "Hass avocados", "Produce", "each", "each", "48-count size"),
    # Pantry
    ("prd_vanilla", "Pure vanilla extract", "Pantry", "ml", "fl_oz", "Pure, single-fold"),
    ("prd_baking_soda", "Baking soda", "Pantry", "g", "lb", "Sodium bicarbonate"),
    ("prd_baking_powder", "Baking powder, double-acting", "Pantry", "g", "lb", "Aluminum-free"),
    ("prd_salt_kosher", "Kosher salt", "Pantry", "g", "lb", "Flake kosher salt"),
    ("prd_yeast_instant", "Instant dry yeast", "Pantry", "g", "lb", "Instant, vacuum packed"),
    ("prd_choc_chips", "Semisweet chocolate chips", "Pantry", "g", "lb", "4000 ct/lb, 45% cacao"),
    ("prd_cocoa", "Cocoa powder, Dutch process", "Pantry", "g", "lb", "22-24% fat"),
    ("prd_oil_canola", "Canola oil", "Pantry", "g", "lb", "Clear, fry and bake"),
    ("prd_oil_evoo", "Extra virgin olive oil", "Pantry", "ml", "l", "EVOO"),
    # Packaging
    ("prd_cup_hot_12", "Hot cups, 12 oz", "Packaging", "each", "each", "Double-wall paper"),
    ("prd_lid_hot_12", "Hot cup lids, 12 oz", "Packaging", "each", "each", "Fits 12 oz hot cup, sip lid"),
    ("prd_cup_cold_16", "Cold cups, 16 oz", "Packaging", "each", "each", "Clear PET"),
    ("prd_box_pastry_10", "Pastry boxes, 10x10x5", "Packaging", "each", "each", "White, lock corner"),
    ("prd_bag_bakery", "Bakery bags, wax-lined", "Packaging", "each", "each", "6x3x11"),
    ("prd_deli_32", "Deli containers, 32 oz with lids", "Packaging", "each", "each", "Polypropylene"),
    ("prd_napkins", "Dinner napkins", "Packaging", "each", "each", "2-ply, 1/8 fold"),
]

# Offers: product -> list of (supplier, supplier SKU, pack qty, pack unit,
#                              pack label, list price in cents, packs in stock)
# A pack is the smallest unit the supplier will sell (a bag, case, flat...).
O = {
    "prd_flour_ap_unbl": [
        ("sup_kestrel", "KF-10021", "50", "lb", "50 lb bag", 2689, 120),
        ("sup_bramblewood", "BB-FL-AP50", "50", "lb", "50 lb bag", 2875, 80),
        ("sup_pelican", "PWC-44810", "25", "lb", "25 lb bag", 1299, 18),
    ],
    "prd_flour_ap_bl": [
        ("sup_kestrel", "KF-10022", "50", "lb", "50 lb bag", 2459, 60),
        ("sup_pelican", "PWC-44811", "25", "lb", "25 lb bag", 1149, 30),
    ],
    "prd_flour_bread": [
        ("sup_kestrel", "KF-10030", "50", "lb", "50 lb bag", 3119, 40),
        ("sup_bramblewood", "BB-FL-BR50", "50", "lb", "50 lb bag", 3299, 50),
    ],
    "prd_flour_cake": [
        ("sup_bramblewood", "BB-FL-CK50", "50", "lb", "50 lb bag", 3850, 20),
        ("sup_kestrel", "KF-10035", "50", "lb", "50 lb bag", 3725, 6),
    ],
    "prd_flour_ww": [
        ("sup_bramblewood", "BB-FL-WW50", "50", "lb", "50 lb bag", 3240, 15),
    ],
    "prd_flour_almond": [
        ("sup_bramblewood", "BB-NT-ALM25", "25", "lb", "25 lb box", 14250, 8),
        ("sup_kestrel", "KF-20411", "3", "lb", "3 lb bag", 1899, 25),
    ],
    "prd_oats_rolled": [
        ("sup_kestrel", "KF-10110", "50", "lb", "50 lb bag", 4425, 20),
        ("sup_pelican", "PWC-30219", "10", "lb", "10 lb bag", 1049, 40),
    ],
    "prd_rice_jasmine": [
        ("sup_kestrel", "KF-10210", "50", "lb", "50 lb bag", 5490, 30),
        ("sup_pelican", "PWC-30340", "25", "lb", "25 lb bag", 2499, 22),
    ],
    "prd_pasta_penne": [
        ("sup_kestrel", "KF-10305", "20", "lb", "Case, 2 x 10 lb", 2799, 45),
        ("sup_pelican", "PWC-30355", "10", "lb", "10 lb box", 1299, 30),
    ],
    "prd_sugar_gran_cane": [
        ("sup_kestrel", "KF-11001", "50", "lb", "50 lb bag", 4699, 70),
        ("sup_bramblewood", "BB-SU-GR50", "50", "lb", "50 lb bag", 4425, 45),
        ("sup_pelican", "PWC-44901", "25", "lb", "25 lb bag", 2049, 24),
    ],
    "prd_sugar_gran_beet": [
        ("sup_kestrel", "KF-11002", "50", "lb", "50 lb bag", 4189, 50),
    ],
    "prd_sugar_powdered": [
        ("sup_bramblewood", "BB-SU-PW50", "50", "lb", "50 lb bag", 5590, 25),
        ("sup_kestrel", "KF-11010", "2", "lb", "2 lb bag", 289, 200),
    ],
    "prd_sugar_brown_light": [
        ("sup_bramblewood", "BB-SU-BR25", "25", "lb", "25 lb bag", 2975, 20),
        ("sup_kestrel", "KF-11020", "25", "lb", "25 lb bag", 3110, 30),
    ],
    "prd_honey": [
        ("sup_kestrel", "KF-12001", "5", "lb", "5 lb jug", 2790, 12),
        ("sup_pelican", "PWC-50102", "5", "lb", "5 lb jug", 2399, 8),
    ],
    "prd_eggs_large": [
        ("sup_meadowlark", "MDC-EG-L15", "15", "dozen", "Case, 15 dozen", 5250, 40),
        ("sup_kestrel", "KF-13001", "30", "dozen", "Case, 30 dozen", 9990, 25),
        ("sup_pelican", "PWC-60010", "5", "dozen", "5 dozen flat", 1599, 12),
    ],
    "prd_butter_unsalted": [
        ("sup_meadowlark", "MDC-BT-U36", "36", "lb", "Case, 36 x 1 lb", 15480, 4),
        ("sup_bramblewood", "BB-DA-BU36", "36", "lb", "Case, 36 x 1 lb", 15990, 4),
        ("sup_kestrel", "KF-14001", "36", "lb", "Case, 36 x 1 lb", 15120, 6),
    ],
    "prd_butter_salted": [
        ("sup_meadowlark", "MDC-BT-S36", "36", "lb", "Case, 36 x 1 lb", 15620, 20),
        ("sup_kestrel", "KF-14002", "36", "lb", "Case, 36 x 1 lb", 15390, 10),
    ],
    "prd_butter_euro": [
        ("sup_bramblewood", "BB-DA-EU10", "10", "kg", "10 kg block", 21900, 6),
    ],
    "prd_milk_whole": [
        ("sup_meadowlark", "MDC-MK-W4", "4", "gal", "Case, 4 x 1 gal", 1990, 60),
        ("sup_kestrel", "KF-15001", "4", "gal", "Case, 4 x 1 gal", 2140, 30),
        ("sup_pelican", "PWC-60101", "2", "gal", "2 x 1 gal", 849, 20),
    ],
    "prd_cream_heavy": [
        ("sup_meadowlark", "MDC-CR-H12", "12", "qt", "Case, 12 x 1 qt", 5590, 30),
        ("sup_kestrel", "KF-15010", "12", "qt", "Case, 12 x 1 qt", 5890, 15),
    ],
    "prd_half_half": [
        ("sup_meadowlark", "MDC-CR-HH12", "12", "qt", "Case, 12 x 1 qt", 3040, 40),
        ("sup_kestrel", "KF-15020", "12", "qt", "Case, 12 x 1 qt", 3190, 20),
    ],
    "prd_oat_milk": [
        ("sup_meadowlark", "MDC-PL-OAT12", "12", "qt", "Case, 12 x 32 oz", 4200, 25),
        ("sup_kestrel", "KF-15030", "12", "qt", "Case, 12 x 32 oz", 3990, 12),
        ("sup_pelican", "PWC-60150", "6", "qt", "6 x 32 oz", 1899, 10),
    ],
    "prd_cream_cheese": [
        ("sup_meadowlark", "MDC-CH-CC30", "30", "lb", "Case, 10 x 3 lb loaf", 9450, 12),
        ("sup_kestrel", "KF-15040", "30", "lb", "Case, 10 x 3 lb loaf", 9190, 8),
    ],
    "prd_parmesan": [
        ("sup_kestrel", "KF-15050", "5", "lb", "5 lb bag", 4390, 15),
        ("sup_meadowlark", "MDC-CH-PG5", "5", "lb", "5 lb bag", 4650, 10),
    ],
    "prd_mozz_shred": [
        ("sup_kestrel", "KF-15060", "20", "lb", "Case, 4 x 5 lb", 7790, 20),
        ("sup_meadowlark", "MDC-CH-MZ20", "20", "lb", "Case, 4 x 5 lb", 8120, 15),
    ],
    "prd_coffee_espresso": [
        ("sup_kestrel", "KF-16001", "5", "lb", "5 lb bag", 5890, 20),
        ("sup_pelican", "PWC-70010", "2", "lb", "2 lb bag", 2299, 15),
    ],
    "prd_coffee_drip": [
        ("sup_kestrel", "KF-16010", "5", "lb", "5 lb bag", 4490, 25),
        ("sup_pelican", "PWC-70020", "2", "lb", "2 lb bag", 1699, 20),
    ],
    "prd_coffee_decaf": [
        ("sup_kestrel", "KF-16020", "5", "lb", "5 lb bag", 6120, 6),
    ],
    "prd_tea_chai": [
        ("sup_kestrel", "KF-16100", "2", "qt", "Case, 2 x 32 oz", 1590, 20),
        ("sup_meadowlark", "MDC-BV-CH6", "6", "qt", "Case, 6 x 32 oz", 4590, 10),
    ],
    "prd_lemons": [
        ("sup_citrusrow", "CR-LEM-115", "115", "each", "Case, 115 ct", 4290, 15),
        ("sup_kestrel", "KF-17001", "165", "each", "Case, 165 ct", 5990, 8),
    ],
    "prd_limes": [
        ("sup_citrusrow", "CR-LIM-200", "200", "each", "Case, 200 ct", 3850, 10),
        ("sup_kestrel", "KF-17002", "200", "each", "Case, 200 ct", 4120, 5),
    ],
    "prd_strawberries": [
        ("sup_citrusrow", "CR-STR-8", "8", "lb", "Flat, 8 x 1 lb", 2650, 6),
        ("sup_kestrel", "KF-17010", "8", "lb", "Flat, 8 x 1 lb", 2990, 10),
    ],
    "prd_blueberries": [
        ("sup_citrusrow", "CR-BLU-12", "9", "lb", "Flat, 12 x 12 oz", 3990, 3),
        ("sup_kestrel", "KF-17020", "9", "lb", "Flat, 12 x 12 oz", 4390, 4),
    ],
    "prd_bananas": [
        ("sup_citrusrow", "CR-BAN-40", "40", "lb", "Case, 40 lb", 2890, 20),
        ("sup_pelican", "PWC-80010", "20", "lb", "Half case, 20 lb", 1199, 15),
    ],
    "prd_onion_yellow": [
        ("sup_citrusrow", "CR-ONY-50", "50", "lb", "Sack, 50 lb", 3190, 20),
        ("sup_kestrel", "KF-17101", "50", "lb", "Sack, 50 lb", 2990, 25),
    ],
    "prd_tomato_roma": [
        ("sup_citrusrow", "CR-TOM-25", "25", "lb", "Case, 25 lb", 2990, 15),
        ("sup_kestrel", "KF-17110", "25", "lb", "Case, 25 lb", 2850, 15),
    ],
    "prd_romaine": [
        ("sup_citrusrow", "CR-ROM-24", "24", "each", "Case, 24 hearts", 3590, 12),
        ("sup_kestrel", "KF-17120", "24", "each", "Case, 24 hearts", 3890, 10),
    ],
    "prd_garlic_peeled": [
        ("sup_citrusrow", "CR-GAR-5", "5", "lb", "5 lb jar", 2190, 10),
        ("sup_kestrel", "KF-17130", "5", "lb", "5 lb jar", 2290, 12),
    ],
    "prd_avocado": [
        ("sup_citrusrow", "CR-AVO-48", "48", "each", "Case, 48 ct", 6990, 8),
        ("sup_kestrel", "KF-17140", "48", "each", "Case, 48 ct", 7290, 6),
    ],
    "prd_vanilla": [
        ("sup_bramblewood", "BB-FL-VAN1", "1", "gal", "1 gal jug", 18900, 6),
        ("sup_kestrel", "KF-18001", "32", "fl_oz", "32 fl oz bottle", 5490, 10),
    ],
    "prd_baking_soda": [
        ("sup_bramblewood", "BB-LV-BS25", "25", "lb", "25 lb bag", 2690, 10),
        ("sup_kestrel", "KF-18010", "25", "lb", "25 lb bag", 2850, 10),
    ],
    "prd_baking_powder": [
        ("sup_bramblewood", "BB-LV-BP5", "5", "lb", "5 lb tub", 1750, 20),
        ("sup_kestrel", "KF-18011", "5", "lb", "5 lb tub", 1840, 15),
    ],
    "prd_salt_kosher": [
        ("sup_kestrel", "KF-18020", "27", "lb", "Case, 9 x 3 lb", 4390, 10),
        ("sup_pelican", "PWC-50210", "3", "lb", "3 lb box", 499, 40),
    ],
    "prd_yeast_instant": [
        ("sup_bramblewood", "BB-LV-YI2", "2", "lb", "Case, 2 x 1 lb", 1190, 30),
        ("sup_kestrel", "KF-18030", "2", "lb", "Case, 2 x 1 lb", 1290, 20),
    ],
    "prd_choc_chips": [
        ("sup_bramblewood", "BB-CH-SS25", "25", "lb", "25 lb box", 9450, 12),
        ("sup_kestrel", "KF-18040", "25", "lb", "25 lb box", 9890, 6),
    ],
    "prd_cocoa": [
        ("sup_bramblewood", "BB-CH-CO5", "5", "lb", "5 lb bag", 4390, 10),
    ],
    "prd_oil_canola": [
        ("sup_kestrel", "KF-18100", "35", "lb", "35 lb jug", 4590, 20),
        ("sup_pelican", "PWC-50300", "35", "lb", "35 lb jug", 4290, 6),
    ],
    "prd_oil_evoo": [
        ("sup_kestrel", "KF-18110", "3", "l", "3 L tin", 3890, 15),
        ("sup_pelican", "PWC-50310", "3", "l", "3 L tin", 3490, 8),
    ],
    "prd_cup_hot_12": [
        ("sup_kestrel", "KF-19001", "1000", "each", "Case, 1000 ct", 8490, 15),
        ("sup_pelican", "PWC-90010", "500", "each", "Sleeve pack, 500 ct", 4590, 10),
    ],
    "prd_lid_hot_12": [
        ("sup_kestrel", "KF-19002", "1000", "each", "Case, 1000 ct", 4490, 15),
        ("sup_pelican", "PWC-90011", "500", "each", "Sleeve pack, 500 ct", 2390, 10),
    ],
    "prd_cup_cold_16": [
        ("sup_kestrel", "KF-19010", "1000", "each", "Case, 1000 ct", 9490, 10),
        ("sup_pelican", "PWC-90020", "600", "each", "Case, 600 ct", 5490, 10),
    ],
    "prd_box_pastry_10": [
        ("sup_bramblewood", "BB-PK-BX10", "100", "each", "Bundle, 100 ct", 5290, 20),
        ("sup_kestrel", "KF-19020", "100", "each", "Bundle, 100 ct", 5590, 10),
    ],
    "prd_bag_bakery": [
        ("sup_bramblewood", "BB-PK-BG6", "1000", "each", "Case, 1000 ct", 3990, 15),
        ("sup_kestrel", "KF-19030", "1000", "each", "Case, 1000 ct", 4190, 10),
    ],
    "prd_deli_32": [
        ("sup_kestrel", "KF-19040", "240", "each", "Case, 240 ct", 5490, 15),
        ("sup_pelican", "PWC-90030", "120", "each", "Sleeve pack, 120 ct", 2990, 10),
    ],
    "prd_napkins": [
        ("sup_kestrel", "KF-19050", "3000", "each", "Case, 3000 ct", 4990, 10),
        ("sup_pelican", "PWC-90040", "1500", "each", "Pack, 1500 ct", 2690, 10),
    ],
}

# Freshness timestamps. Default: prices updated Monday, stock snapshot this morning.
DEFAULT_PRICE_UPDATED = "2026-11-02T08:00:00-05:00"
DEFAULT_STOCK_AS_OF = "2026-11-05T06:00:00-05:00"
# Scenario 8: deliberately stale data (see STALE policy in meta.freshness_policy).
STALE_PRICE = {("sup_pelican", "prd_coffee_espresso"): "2026-09-28T08:00:00-05:00"}
STALE_STOCK = {("sup_citrusrow", "prd_blueberries"): "2026-11-02T06:00:00-05:00"}
MISSING_STOCK = {("sup_pelican", "prd_honey")}  # no inventory snapshot at all

# Optional per-offer rules, only where they are explicitly part of the demo.
MIN_PACKS = {("sup_pelican", "prd_bananas"): 2}
PRICE_TIERS = {
    # Volume tier: 10+ bags of AP flour from Bramblewood drops to $27.25/bag.
    ("sup_bramblewood", "prd_flour_ap_unbl"): [{"min_packs": 10, "price_cents": 2725}],
}

BUYERS = [
    {
        "id": "org_sundaycrumb",
        "name": "Sunday Crumb Bakery (Demo)",
        "kind": "bakery",
        "locations": [
            {"id": "loc_sundaycrumb_wp", "name": "Winter Park shop", "zone": "ORL-WP",
             "address_label": "Fictional address, Winter Park zone"},
        ],
        # Buyer-specific (negotiated) prices. Visible ONLY to this buyer.
        "contract_prices": [
            ("sup_bramblewood", "prd_flour_ap_unbl", 2650),
            ("sup_meadowlark", "prd_eggs_large", 4990),
        ],
        "approved_equivalences": ["eqv_sugar_gran"],
        "saved_lists": [
            {
                "id": "lst_sundaycrumb_weekly",
                "name": "Weekly bake order",
                "lines": [
                    # product, qty, unit, current supplier (the buyer's habit = baseline)
                    ("prd_flour_ap_unbl", "300", "lb", "sup_bramblewood"),
                    ("prd_flour_bread", "100", "lb", "sup_bramblewood"),
                    ("prd_sugar_gran_cane", "100", "lb", "sup_bramblewood"),
                    ("prd_sugar_brown_light", "25", "lb", "sup_bramblewood"),
                    ("prd_butter_unsalted", "72", "lb", "sup_meadowlark"),
                    ("prd_eggs_large", "30", "dozen", "sup_meadowlark"),
                    ("prd_milk_whole", "8", "gal", "sup_meadowlark"),
                    ("prd_cream_heavy", "12", "qt", "sup_meadowlark"),
                    ("prd_yeast_instant", "4", "lb", "sup_bramblewood"),
                    ("prd_choc_chips", "25", "lb", "sup_bramblewood"),
                    ("prd_vanilla", "64", "fl_oz", "sup_bramblewood"),
                    ("prd_box_pastry_10", "200", "each", "sup_bramblewood"),
                    ("prd_bag_bakery", "1000", "each", "sup_bramblewood"),
                    ("prd_strawberries", "16", "lb", "sup_citrusrow"),
                ],
            }
        ],
    },
    {
        "id": "org_thirdshift",
        "name": "Third Shift Coffee (Demo)",
        "kind": "cafe",
        "locations": [
            {"id": "loc_thirdshift_ucf", "name": "University shop", "zone": "ORL-UCF",
             "address_label": "Fictional address, East Orlando / UCF zone"},
        ],
        "contract_prices": [
            ("sup_kestrel", "prd_coffee_espresso", 5590),
            ("sup_meadowlark", "prd_milk_whole", 1890),
        ],
        "approved_equivalences": [],
        "saved_lists": [
            {
                "id": "lst_thirdshift_weekly",
                "name": "Weekly café restock",
                "lines": [
                    ("prd_coffee_espresso", "20", "lb", "sup_kestrel"),
                    ("prd_coffee_drip", "15", "lb", "sup_kestrel"),
                    ("prd_coffee_decaf", "5", "lb", "sup_kestrel"),
                    ("prd_milk_whole", "24", "gal", "sup_meadowlark"),
                    ("prd_oat_milk", "24", "qt", "sup_meadowlark"),
                    ("prd_half_half", "12", "qt", "sup_meadowlark"),
                    ("prd_tea_chai", "6", "qt", "sup_meadowlark"),
                    ("prd_cup_hot_12", "2000", "each", "sup_kestrel"),
                    ("prd_lid_hot_12", "2000", "each", "sup_kestrel"),
                    ("prd_cup_cold_16", "1000", "each", "sup_kestrel"),
                    ("prd_bananas", "20", "lb", "sup_citrusrow"),
                    ("prd_cream_cheese", "30", "lb", "sup_meadowlark"),
                ],
            }
        ],
    },
    {
        "id": "org_littlejuniper",
        "name": "Little Juniper Kitchen (Demo)",
        "kind": "restaurant",
        "locations": [
            {"id": "loc_littlejuniper_dt", "name": "Downtown dining room", "zone": "ORL-DT",
             "address_label": "Fictional address, Downtown Orlando zone"},
        ],
        "contract_prices": [
            ("sup_kestrel", "prd_mozz_shred", 7490),
        ],
        "approved_equivalences": [],
        "saved_lists": [
            {
                "id": "lst_littlejuniper_weekly",
                "name": "Weekly kitchen order",
                "lines": [
                    ("prd_onion_yellow", "50", "lb", "sup_kestrel"),
                    ("prd_tomato_roma", "50", "lb", "sup_kestrel"),
                    ("prd_romaine", "48", "each", "sup_kestrel"),
                    ("prd_garlic_peeled", "10", "lb", "sup_kestrel"),
                    ("prd_lemons", "115", "each", "sup_kestrel"),
                    ("prd_avocado", "48", "each", "sup_kestrel"),
                    ("prd_rice_jasmine", "50", "lb", "sup_kestrel"),
                    ("prd_pasta_penne", "40", "lb", "sup_kestrel"),
                    ("prd_parmesan", "10", "lb", "sup_kestrel"),
                    ("prd_mozz_shred", "40", "lb", "sup_kestrel"),
                    ("prd_oil_evoo", "6", "l", "sup_kestrel"),
                    ("prd_oil_canola", "70", "lb", "sup_kestrel"),
                    ("prd_eggs_large", "15", "dozen", "sup_kestrel"),
                    ("prd_cream_heavy", "12", "qt", "sup_kestrel"),
                    ("prd_deli_32", "240", "each", "sup_kestrel"),
                    ("prd_napkins", "3000", "each", "sup_kestrel"),
                ],
            }
        ],
    },
]

# Explicit equivalence rules. A substitution is only ever considered when a rule
# exists AND the buyer has approved it. Nothing is substituted silently.
EQUIVALENCES = [
    {
        "id": "eqv_sugar_gran",
        "product_ids": ["prd_sugar_gran_cane", "prd_sugar_gran_beet"],
        "note": "Cane and beet granulated sugar are interchangeable for most baking.",
        "requires_buyer_approval": True,
    },
    {
        "id": "eqv_flour_ap",
        "product_ids": ["prd_flour_ap_unbl", "prd_flour_ap_bl"],
        "note": "Bleached flour changes texture and color; many bakers will not accept it.",
        "requires_buyer_approval": True,
    },
]

# Test scenarios required by the MVP spec. `expect` is the intended behaviour;
# the optimizer test suite (Milestone 3) asserts each one.
SCENARIOS = [
    {
        "id": "scn_01_cheap_items_not_cheap_basket",
        "title": "Cheapest items are not the cheapest delivered basket",
        "buyer_id": "org_thirdshift", "zone": "ORL-UCF", "delivery_date": "2026-11-11",
        "lines": [("prd_milk_whole", "16", "gal"), ("prd_oat_milk", "12", "qt")],
        "expect": "Pelican has the lowest per-unit price on both items, but its $45 flat fee makes it more expensive delivered than Meadowlark.",
    },
    {
        "id": "scn_02_bundle_one_supplier",
        "title": "Bundling everything with one supplier saves money",
        "buyer_id": "org_sundaycrumb", "zone": "ORL-WP", "delivery_date": "2026-11-10",
        "lines": [("prd_flour_ap_unbl", "250", "lb"), ("prd_sugar_gran_cane", "50", "lb"), ("prd_butter_unsalted", "36", "lb"),
                  ("prd_box_pastry_10", "200", "each"), ("prd_choc_chips", "25", "lb")],
        "expect": "Meadowlark's butter is $5.10 cheaper per case, but buying it from Bramblewood with everything else crosses Bramblewood's $500 free-delivery threshold and avoids a second delivery fee.",
    },
    {
        "id": "scn_03_stock_forces_two_suppliers",
        "title": "Two suppliers required because of stock",
        "buyer_id": "org_sundaycrumb", "zone": "ORL-WP", "delivery_date": "2026-11-10",
        "lines": [("prd_butter_unsalted", "288", "lb")],
        "expect": "288 lb = 8 cases. Meadowlark and Bramblewood each have only 4 cases in stock, so the line must be split across both.",
    },
    {
        "id": "scn_04_minimum_invalidates_cheap_supplier",
        "title": "Order minimum rules out an apparently cheap supplier",
        "buyer_id": "org_littlejuniper", "zone": "ORL-DT", "delivery_date": "2026-11-09",
        "lines": [("prd_onion_yellow", "100", "lb"), ("prd_tomato_roma", "25", "lb")],
        "expect": "Kestrel is cheaper per item, but this order is far below its $400 minimum, so Citrus Row is recommended.",
    },
    {
        "id": "scn_05_delivery_day_changes_answer",
        "title": "Delivery day changes the recommendation",
        "buyer_id": "org_thirdshift", "zone": "ORL-UCF", "delivery_date": "2026-11-14",
        "compare_delivery_date": "2026-11-11",
        "lines": [("prd_cup_hot_12", "2000", "each"), ("prd_lid_hot_12", "2000", "each"),
                  ("prd_cup_cold_16", "1000", "each"), ("prd_napkins", "6000", "each")],
        "expect": "On Saturday only Pelican delivers. On Wednesday Kestrel also delivers, the order clears its minimum, and Kestrel is cheaper.",
    },
    {
        "id": "scn_06_pack_size_normalization",
        "title": "Equivalent pack sizes are normalized",
        "buyer_id": "org_littlejuniper", "zone": "ORL-DT", "delivery_date": "2026-11-11",
        "lines": [("prd_eggs_large", "360", "each"), ("prd_cream_heavy", "12", "qt")],
        "expect": "360 eggs = 30 dozen. Meadowlark's 15-dozen case, Kestrel's 30-dozen case and Pelican's 5-dozen flat are compared on the same per-egg basis, including any overbuy.",
    },
    {
        "id": "scn_07_no_feasible_solution",
        "title": "No feasible solution",
        "buyer_id": "org_sundaycrumb", "zone": "ORL-WP", "delivery_date": "2026-11-08",
        "lines": [("prd_flour_ww", "100", "lb"), ("prd_flour_cake", "50", "lb")],
        "expect": "Sunday 2026-11-08: no supplier delivers on Sundays. The explanation lists each supplier's delivery days.",
    },
    {
        "id": "scn_08_stale_data_flagged",
        "title": "Stale price and stock are flagged",
        "buyer_id": "org_thirdshift", "zone": "ORL-UCF", "delivery_date": "2026-11-11",
        "lines": [("prd_coffee_espresso", "10", "lb"), ("prd_blueberries", "9", "lb"),
                  ("prd_cup_hot_12", "2000", "each"), ("prd_lid_hot_12", "2000", "each")],
        "expect": "Pelican's espresso price is older than 14 days and Citrus Row's blueberry stock is older than 36 hours: both offers are excluded and flagged, never silently used.",
    },
]


def build() -> dict:
    product_ids = {p[0] for p in PRODUCTS}
    supplier_ids = {s["id"] for s in SUPPLIERS}

    offers = []
    for product_id, rows in O.items():
        assert product_id in product_ids, product_id
        for supplier_id, sku, qty, unit, label, price, stock in rows:
            assert supplier_id in supplier_ids, supplier_id
            key = (supplier_id, product_id)
            offers.append(
                {
                    "id": f"ofr_{sku.lower().replace('-', '_')}",
                    "supplier_id": supplier_id,
                    "product_id": product_id,
                    "supplier_sku": sku,
                    "pack": {"quantity": qty, "unit": unit, "label": label},
                    "list_price_cents": price,
                    "min_packs": MIN_PACKS.get(key, 1),
                    "price_tiers": PRICE_TIERS.get(key, []),
                    "price_updated_at": STALE_PRICE.get(key, DEFAULT_PRICE_UPDATED),
                    "inventory": None
                    if key in MISSING_STOCK
                    else {"packs_available": stock, "as_of": STALE_STOCK.get(key, DEFAULT_STOCK_AS_OF)},
                    "mapping": {"method": "supplier_provided", "reviewed": True},
                    "source": {"type": "synthetic_seed", "import_id": IMPORT_ID},
                    "synthetic": True,
                }
            )

    offer_keys = {(o["supplier_id"], o["product_id"]) for o in offers}

    buyers = []
    for b in BUYERS:
        for sup, prd, _ in b["contract_prices"]:
            assert (sup, prd) in offer_keys, (b["id"], sup, prd)
        buyers.append(
            {
                "id": b["id"],
                "name": b["name"],
                "kind": b["kind"],
                "synthetic": True,
                "locations": b["locations"],
                "approved_equivalences": b["approved_equivalences"],
                "contract_prices": [
                    {"supplier_id": s, "product_id": p, "price_cents": c} for s, p, c in b["contract_prices"]
                ],
                "saved_lists": [
                    {
                        "id": lst["id"],
                        "name": lst["name"],
                        "lines": [
                            {"product_id": p, "quantity": q, "unit": u, "current_supplier_id": s}
                            for p, q, u, s in lst["lines"]
                        ],
                    }
                    for lst in b["saved_lists"]
                ],
            }
        )

    return {
        "meta": {
            "dataset": "supplypilot-demo-v1",
            "synthetic": True,
            "label": "Demo data — not live supplier pricing",
            "currency": "USD",
            "timezone": "America/New_York",
            "market": "Orlando, FL (demo)",
            "reference_now": REFERENCE_NOW,
            "freshness_policy": {
                "price_max_age_hours": 24 * 14,
                "inventory_max_age_hours": 36,
                "on_stale": "exclude_and_flag",
                "on_missing_inventory": "exclude_and_flag",
            },
        },
        "catalog_imports": [
            {
                "id": IMPORT_ID,
                "source_type": "synthetic_seed",
                "description": "Generated by data/seed/generate_seed.py. Invented data for demos and tests.",
                "imported_at": "2026-11-02T08:00:00-05:00",
                "supplier_ids": sorted(supplier_ids),
            }
        ],
        "units": [
            {"code": c, "label": lab, "dimension": d, "base_unit": base, "to_base": f}
            for c, lab, d, base, f in UNITS
        ],
        "zones": [{"id": z, "name": n} for z, n in ZONES],
        "suppliers": [{**s, "synthetic": True} for s in SUPPLIERS],
        "products": [
            {"id": i, "name": n, "category": c, "base_unit": bu, "default_unit": du, "spec": sp}
            for i, n, c, bu, du, sp in PRODUCTS
        ],
        "equivalences": EQUIVALENCES,
        "offers": offers,
        "buyers": buyers,
        "scenarios": [
            {**s, "lines": [{"product_id": p, "quantity": q, "unit": u} for p, q, u in s["lines"]]}
            for s in SCENARIOS
        ],
    }


if __name__ == "__main__":
    data = build()
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} — {len(data['products'])} products, {len(data['offers'])} offers, "
          f"{len(data['suppliers'])} suppliers, {len(data['buyers'])} buyers")
