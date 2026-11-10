/**
 * How each stocked product is shown: its icon and the shelf group it sits in. Display only.
 */
import {
  Apple,
  Banana,
  Candy,
  Cherry,
  Citrus,
  Coffee,
  Container,
  Cookie,
  CupSoda,
  Cuboid,
  Disc,
  Droplet,
  Egg,
  FlaskConical,
  Layers,
  Leaf,
  LeafyGreen,
  Milk,
  Package,
  Pizza,
  Salad,
  ShoppingBag,
  Sprout,
  Utensils,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export interface Look {
  icon: LucideIcon;
  group: (typeof GROUPS)[number];
}

export const GROUPS = [
  "Dairy & eggs",
  "Flour & sugar",
  "Coffee & tea",
  "Produce",
  "Pantry",
  "Packaging",
] as const;

const BY_ID: Record<string, Look> = {
  prd_milk_whole: { icon: Milk, group: "Dairy & eggs" },
  prd_cream_heavy: { icon: Milk, group: "Dairy & eggs" },
  prd_half_half: { icon: Milk, group: "Dairy & eggs" },
  prd_oat_milk: { icon: Milk, group: "Dairy & eggs" },
  prd_eggs_large: { icon: Egg, group: "Dairy & eggs" },
  prd_butter_unsalted: { icon: Cuboid, group: "Dairy & eggs" },
  prd_cream_cheese: { icon: Cuboid, group: "Dairy & eggs" },
  prd_parmesan: { icon: Pizza, group: "Dairy & eggs" },
  prd_mozz_shred: { icon: Pizza, group: "Dairy & eggs" },
  prd_flour_ap_unbl: { icon: Wheat, group: "Flour & sugar" },
  prd_flour_bread: { icon: Wheat, group: "Flour & sugar" },
  prd_sugar_gran_cane: { icon: Candy, group: "Flour & sugar" },
  prd_sugar_brown_light: { icon: Candy, group: "Flour & sugar" },
  prd_rice_jasmine: { icon: Wheat, group: "Pantry" },
  prd_pasta_penne: { icon: Utensils, group: "Pantry" },
  prd_coffee_espresso: { icon: Coffee, group: "Coffee & tea" },
  prd_coffee_drip: { icon: Coffee, group: "Coffee & tea" },
  prd_coffee_decaf: { icon: Coffee, group: "Coffee & tea" },
  prd_tea_chai: { icon: Leaf, group: "Coffee & tea" },
  prd_vanilla: { icon: FlaskConical, group: "Pantry" },
  prd_oil_canola: { icon: Droplet, group: "Pantry" },
  prd_oil_evoo: { icon: Droplet, group: "Pantry" },
  prd_yeast_instant: { icon: Sprout, group: "Pantry" },
  prd_choc_chips: { icon: Cookie, group: "Pantry" },
  prd_lemons: { icon: Citrus, group: "Produce" },
  prd_strawberries: { icon: Cherry, group: "Produce" },
  prd_bananas: { icon: Banana, group: "Produce" },
  prd_tomato_roma: { icon: Apple, group: "Produce" },
  prd_romaine: { icon: Salad, group: "Produce" },
  prd_onion_yellow: { icon: LeafyGreen, group: "Produce" },
  prd_garlic_peeled: { icon: LeafyGreen, group: "Produce" },
  prd_avocado: { icon: LeafyGreen, group: "Produce" },
  prd_cup_hot_12: { icon: Coffee, group: "Packaging" },
  prd_lid_hot_12: { icon: Disc, group: "Packaging" },
  prd_cup_cold_16: { icon: CupSoda, group: "Packaging" },
  prd_box_pastry_10: { icon: Package, group: "Packaging" },
  prd_bag_bakery: { icon: ShoppingBag, group: "Packaging" },
  prd_deli_32: { icon: Container, group: "Packaging" },
  prd_napkins: { icon: Layers, group: "Packaging" },
};

const BY_CATEGORY: Record<string, Look> = {
  Dairy: { icon: Milk, group: "Dairy & eggs" },
  Eggs: { icon: Egg, group: "Dairy & eggs" },
  "Flour & grains": { icon: Wheat, group: "Flour & sugar" },
  "Sugar & sweeteners": { icon: Candy, group: "Flour & sugar" },
  "Coffee & tea": { icon: Coffee, group: "Coffee & tea" },
  Produce: { icon: LeafyGreen, group: "Produce" },
  Packaging: { icon: Package, group: "Packaging" },
};

export function lookFor(product: { id: string; category: string }): Look {
  return BY_ID[product.id] ?? BY_CATEGORY[product.category] ?? { icon: Package, group: "Pantry" };
}

/** The slider spans two weeks: anything lasting longer reads as "full". */
export const SPAN_DAYS = 14;
