"use server";

/**
 * Cart, saved-list and favorites mutations. Every action:
 *  - acts only on the signed-in buyer's org (from the session, never from the form),
 *  - re-validates ids, quantities and units against the catalog (the browser is untrusted),
 *  - returns a result the UI can show instead of throwing.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  BuyerStateError,
  type BuyerStateRepository,
  type CartLine,
} from "@/lib/buyer-state/repository";
import { catalogContext } from "@/lib/cart/catalog-context";
import { deliveryOptions, isBookableDate } from "@/lib/cart/delivery-options";
import { copyName } from "@/lib/cart/names";
import { validateAmount, validateLine, validateListName } from "@/lib/cart/validation";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession, persistenceProblem } from "@/lib/session";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

type Ctx = Awaited<ReturnType<typeof catalogContext>> & { state: BuyerStateRepository };

async function run(fn: (ctx: Ctx) => Promise<ActionResult | void>): Promise<ActionResult> {
  const session = await getSession();
  if (!session.state) return { ok: false, error: persistenceProblem(session.persistence)! };
  try {
    const result = (await fn({ ...(await catalogContext()), state: session.state })) ?? {
      ok: true,
    };
    if (result.ok) {
      revalidatePath("/cart");
      revalidatePath("/lists");
      revalidatePath("/");
    }
    return result;
  } catch (e) {
    if (e instanceof BuyerStateError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

// ------------------------------------------------------------------------------------- cart

export async function addToCart(productId: string): Promise<ActionResult> {
  return run(async ({ index, state }) => {
    const product = index.products.get(str(productId));
    if (!product) return { ok: false, error: "Unknown product" };
    const added = await state.addLine({
      product_id: product.id,
      quantity: "1",
      unit: product.default_unit,
      current_supplier_id: null,
    });
    return added
      ? { ok: true, message: `Added ${product.name}` }
      : { ok: true, message: `${product.name} is already in your cart` };
  });
}

export async function updateCartLine(
  productId: string,
  quantity: string,
  unit: string,
): Promise<ActionResult> {
  return run(async ({ index, state }) => {
    const product = index.products.get(str(productId));
    if (!product) return { ok: false, error: "Unknown product" };
    const amount = validateAmount(index, product, str(quantity), str(unit));
    if (!amount.ok) return amount;
    await state.updateLine(product.id, amount.value);
  });
}

export async function removeCartLine(productId: string): Promise<ActionResult> {
  return run(async ({ state }) => state.removeLine(str(productId)));
}

export async function clearCart(): Promise<ActionResult> {
  return run(async ({ state }) => {
    await state.setLines([], "replace");
    await state.setDeliveryDate(null);
    return { ok: true, message: "Cart cleared" };
  });
}

/** CSV import: lines were previewed in the browser; validate them all again here. */
export async function importCartLines(
  lines: { product_id: string; quantity: string; unit: string }[],
  mode: "replace" | "merge",
): Promise<ActionResult> {
  return run(async ({ index, supplierIds, state }) => {
    if (!Array.isArray(lines) || lines.length === 0)
      return { ok: false, error: "Nothing to import" };
    if (lines.length > 500) return { ok: false, error: "Too many rows" };
    if (mode !== "replace" && mode !== "merge") return { ok: false, error: "Unknown import mode" };
    const clean: CartLine[] = [];
    const seen = new Set<string>();
    for (const raw of lines) {
      const r = validateLine(index, supplierIds, {
        product_id: str(raw?.product_id),
        quantity: str(raw?.quantity),
        unit: str(raw?.unit),
        current_supplier_id: null,
      });
      if (!r.ok) return { ok: false, error: `${raw?.product_id}: ${r.error}` };
      if (seen.has(r.value.product_id)) return { ok: false, error: "Duplicate products in import" };
      seen.add(r.value.product_id);
      clean.push(r.value);
    }
    await state.setLines(clean, mode);
    return { ok: true, message: `Imported ${clean.length} item${clean.length === 1 ? "" : "s"}` };
  });
}

export async function setDeliveryDate(date: string | null): Promise<ActionResult> {
  return run(async ({ state }) => {
    if (date === null) return state.setDeliveryDate(null);
    const repo = getRepository();
    const session = await getSession();
    const [source, suppliers] = await Promise.all([repo.source(), repo.listSuppliers()]);
    const zone = session.buyer.locations[0]!.zone;
    const options = deliveryOptions(suppliers, zone, source.now, source.timezone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str(date)) || !isBookableDate(date, options)) {
      return { ok: false, error: "Pick a date in the next two weeks" };
    }
    await state.setDeliveryDate(date);
  });
}

export async function setSupplierPreference(
  supplierId: string,
  preference: "preferred" | "neutral" | "excluded",
): Promise<ActionResult> {
  return run(async ({ supplierIds, state }) => {
    const id = str(supplierId);
    if (!supplierIds.has(id)) return { ok: false, error: "Unknown supplier" };
    if (!["preferred", "neutral", "excluded"].includes(preference)) {
      return { ok: false, error: "Unknown preference" };
    }
    const cart = await state.getCart();
    const preferred = cart.preferredSupplierIds.filter((s) => s !== id && supplierIds.has(s));
    const excluded = cart.excludedSupplierIds.filter((s) => s !== id && supplierIds.has(s));
    if (preference === "preferred") preferred.push(id);
    if (preference === "excluded") {
      if (excluded.length + 1 >= supplierIds.size) {
        return { ok: false, error: "Keep at least one supplier allowed" };
      }
      excluded.push(id);
    }
    await state.setSupplierPreferences({ preferred, excluded });
  });
}

// -------------------------------------------------------------------------------- favorites

export async function setFavorite(productId: string, favorite: boolean): Promise<ActionResult> {
  return run(async ({ index, state }) => {
    const product = index.products.get(str(productId));
    if (!product) return { ok: false, error: "Unknown product" };
    await state.setFavorite(product.id, favorite === true);
  });
}

// ------------------------------------------------------------------------------ saved lists

export async function saveCartAsList(name: string): Promise<ActionResult> {
  return run(async ({ state }) => {
    const n = validateListName(str(name));
    if (!n.ok) return n;
    await state.saveCartAsList(n.value);
    return { ok: true, message: `Saved “${n.value}”` };
  });
}

/** Form action (works without JS): load a list into the cart, then open the cart. */
export async function loadSavedListAndOpen(formData: FormData) {
  const result = await run(async ({ state }) => state.loadList(str(formData.get("listId"))));
  redirect(result.ok ? "/cart" : `/cart?error=${encodeURIComponent(result.error)}`);
}

export async function loadSavedList(listId: string): Promise<ActionResult> {
  return run(async ({ state }) => state.loadList(str(listId)));
}

export async function duplicateSavedList(listId: string): Promise<ActionResult> {
  return run(async ({ state }) => {
    const lists = await state.listSavedLists();
    const list = lists.find((l) => l.id === str(listId));
    if (!list) return { ok: false, error: "That list no longer exists" };
    const name = copyName(list.name, new Set(lists.map((l) => l.name)));
    await state.duplicateList(list.id, name);
    return { ok: true, message: `Created “${name}”` };
  });
}

export async function renameSavedList(listId: string, name: string): Promise<ActionResult> {
  return run(async ({ state }) => {
    const n = validateListName(str(name));
    if (!n.ok) return n;
    await state.renameList(str(listId), n.value);
  });
}

export async function deleteSavedList(listId: string): Promise<ActionResult> {
  return run(async ({ state }) => {
    await state.deleteList(str(listId));
    return { ok: true, message: "List deleted" };
  });
}
