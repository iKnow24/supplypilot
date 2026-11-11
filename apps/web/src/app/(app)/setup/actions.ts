"use server";

/**
 * "Set up from your documents". Like every buyer action: scoped to the signed-in org, and
 * everything re-validated here. Each file is read into memory, sent to the AI, and dropped: it
 * is never written to disk, storage or the database.
 */
import { BuyerStateError } from "@/lib/buyer-state/repository";
import { runBuyerAction, str, type ActionResult } from "@/lib/actions/run";
import { catalogContext } from "@/lib/cart/catalog-context";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession, persistenceProblem } from "@/lib/session";
import { readSetupSource, type SetupSource } from "@/lib/store-setup/extract";
import { mb, sizeLimit, sniffSetupFile, unsupportedFileMessage } from "@/lib/store-setup/files";
import { normalizeDocument } from "@/lib/store-setup/normalize";
import { parseCsv, sheetText } from "@/lib/store-setup/sheet";
import type { DocumentDraft } from "@/lib/store-setup/types";
import { validateSetup } from "@/lib/store-setup/validate";
import { readXlsx } from "@/lib/store-setup/xlsx";
import { aiConfigured } from "@/lib/vendor-prices/extract";
import { localDay } from "@/lib/vendor-prices/parse";

/** Each file read costs money, and the public demo signs visitors in automatically. */
const MAX_READS_PER_HOUR = Number(process.env.SETUP_READS_PER_HOUR) || 30;

export type ReadSetupResult = { ok: true; draft: DocumentDraft } | { ok: false; error: string };

export async function readSetupFile(formData: FormData): Promise<ReadSetupResult> {
  const session = await getSession();
  if (!session.state) return { ok: false, error: persistenceProblem(session.persistence)! };
  if (!aiConfigured()) {
    return { ok: false, error: "Reading documents is turned off on this server (no AI key)." };
  }

  const file = formData.get("file");
  const key = str(formData.get("key"));
  if (!/^d\d{1,3}$/.test(key)) return { ok: false, error: "That upload couldn't be read." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file" };
  const name = file.name.slice(0, 120) || "Document";
  if (file.size > sizeLimit("image")) {
    return { ok: false, error: `That file is over ${mb(sizeLimit("image"))}. Use a smaller one.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffSetupFile(bytes, name);
  if (!kind) return { ok: false, error: unsupportedFileMessage(name) };
  if (bytes.length > sizeLimit(kind.kind)) {
    return {
      ok: false,
      error: `That file is over ${mb(sizeLimit(kind.kind))}. Use a smaller one.`,
    };
  }

  // Spreadsheets are parsed here; the AI only sees their cells as text.
  let source: SetupSource;
  let sheetRows: string[][] | null = null;
  if (kind.kind === "csv" || kind.kind === "xlsx") {
    const rows =
      kind.kind === "csv"
        ? { ok: true as const, value: parseCsv(new TextDecoder().decode(bytes)) }
        : readXlsx(bytes);
    if (!rows.ok) return rows;
    if (rows.value.length === 0) return { ok: false, error: "That spreadsheet is empty" };
    sheetRows = rows.value;
    source = { kind: "sheet", text: sheetText(rows.value) };
  } else if (kind.kind === "pdf") {
    source = { kind: "pdf", data: bytes };
  } else {
    source = { kind: "image", data: bytes, mediaType: kind.mediaType };
  }

  try {
    if ((await session.state.logPriceRead()) > MAX_READS_PER_HOUR) {
      return {
        ok: false,
        error: `That's ${MAX_READS_PER_HOUR} documents in the last hour. Try again later.`,
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
  const read = await readSetupSource(source, {
    fileName: name,
    products,
    units,
    today: localDay(new Date()),
  });
  if (!read.ok) return read;
  if (!read.value.is_relevant || read.value.lines.length === 0) {
    return { ok: false, error: "Nothing about items you buy or keep in stock was found in it." };
  }
  return {
    ok: true,
    draft: normalizeDocument(read.value, {
      key,
      fileName: name,
      index,
      products,
      suppliers,
      sheetRows,
    }),
  };
}

export async function saveStoreSetup(payload: unknown): Promise<ActionResult> {
  return runBuyerAction(async ({ index, state }) => {
    const suppliers = await getRepository().listSuppliers();
    const checked = validateSetup(payload, {
      index,
      suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
      today: localDay(new Date()),
    });
    if (!checked.ok) return checked;
    await state.saveStoreSetup(checked.value);
    const n = checked.value.items.filter((i) => i.product_id).length;
    return {
      ok: true,
      message: `Your store is set up with ${n} ${n === 1 ? "item" : "items"}`,
      href: "/home?setup=done",
    };
  });
}
