"use server";

/**
 * Vendor prices from a screenshot. Like every buyer action: scoped to the signed-in org,
 * everything re-validated here. The image is read into memory, sent to the AI, and dropped:
 * it is never written to disk or the database.
 */
import { redirect } from "next/navigation";

import { BuyerStateError } from "@/lib/buyer-state/repository";
import { catalogContext } from "@/lib/cart/catalog-context";
import { runBuyerAction, str, type ActionResult } from "@/lib/actions/run";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession, persistenceProblem } from "@/lib/session";
import { aiConfigured, readPriceImage } from "@/lib/vendor-prices/extract";
import { describeLimit, MAX_IMAGE_BYTES, sniffImageType } from "@/lib/vendor-prices/image";
import { normalizeExtraction } from "@/lib/vendor-prices/normalize";
import { localDay } from "@/lib/vendor-prices/parse";
import type { PriceDraft } from "@/lib/vendor-prices/types";
import { validatePriceImport } from "@/lib/vendor-prices/validate";

/** Each read costs money and the public demo signs visitors in automatically. */
const MAX_READS_PER_HOUR = Number(process.env.PRICE_READS_PER_HOUR) || 10;

export type ReadResult = { ok: true; draft: PriceDraft } | { ok: false; error: string };

export async function readPriceScreenshot(formData: FormData): Promise<ReadResult> {
  const session = await getSession();
  if (!session.state) return { ok: false, error: persistenceProblem(session.persistence)! };
  if (!aiConfigured()) {
    return { ok: false, error: "Reading screenshots is turned off on this server (no AI key)." };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `That image is over ${describeLimit()}. Crop or shrink it.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return { ok: false, error: "Use a PNG, JPG or WebP image" };

  try {
    if ((await session.state.logPriceRead()) > MAX_READS_PER_HOUR) {
      return {
        ok: false,
        error: `That's ${MAX_READS_PER_HOUR} screenshots in the last hour. Try again later.`,
      };
    }
  } catch (e) {
    if (e instanceof BuyerStateError) return { ok: false, error: e.message };
    throw e;
  }

  const repo = getRepository();
  const [{ index }, products, units, suppliers] = await Promise.all([
    catalogContext(),
    repo.listProducts(),
    repo.units(),
    repo.listSuppliers(),
  ]);
  const read = await readPriceImage(
    { data: bytes, mediaType },
    { products, units, today: localDay(new Date()) },
  );
  if (!read.ok) return read;
  if (!read.value.is_price_document || read.value.lines.length === 0) {
    return {
      ok: false,
      error:
        "No supplier prices found in that image. Try a screenshot of a price list, invoice, email or text.",
    };
  }
  return { ok: true, draft: normalizeExtraction(read.value, { index, products, suppliers }) };
}

export async function savePriceImport(payload: unknown): Promise<ActionResult> {
  return runBuyerAction(async ({ index, supplierIds, state }) => {
    const checked = validatePriceImport(payload, {
      index,
      supplierIds,
      today: localDay(new Date()),
    });
    if (!checked.ok) return checked;
    const id = await state.savePriceImport(checked.value);
    const n = checked.value.lines.length;
    return {
      ok: true,
      message: `Saved ${n} ${n === 1 ? "price" : "prices"} from ${checked.value.vendorName}`,
      href: `/suppliers/import?saved=${id}`,
    };
  });
}

/** Form action: delete one import and its prices. */
export async function deletePriceImport(formData: FormData) {
  const id = str(formData.get("importId"));
  const result = await runBuyerAction(async ({ state }) => {
    if (!(await state.deletePriceImport(id))) {
      return { ok: false, error: "Those prices were already deleted" };
    }
  });
  redirect(
    result.ok
      ? "/suppliers/import?deleted=1"
      : `/suppliers/import?error=${encodeURIComponent(result.error)}`,
  );
}
