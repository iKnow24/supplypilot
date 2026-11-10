"use client";

import { ImageUp, Loader2, RotateCcw, ScanText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { readPriceScreenshot, savePriceImport } from "@/app/(app)/suppliers/import/actions";
import { useAction } from "@/components/cart/status";
import { Button } from "@/components/ui/button";
import type { Product, Unit } from "@/lib/catalog/schema";
import { CatalogIndex, validateAmount } from "@/lib/cart/validation";
import { cn } from "@/lib/utils";
import {
  describeLimit,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
} from "@/lib/vendor-prices/image";
import { centsToInput, parseDollars } from "@/lib/vendor-prices/parse";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  type DocumentKind,
  type PriceDraft,
  type PriceImportPayload,
} from "@/lib/vendor-prices/types";

import { ReviewLineCard, type Decision, type ReviewLine } from "./review-line";

type SupplierOption = { id: string; name: string; short_name: string };
const OTHER = "__other";

/** Photos from a phone are huge: scale them down in the browser before upload. */
async function prepareImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // the server checks the type and says so plainly
  }
  const edge = Math.max(bitmap.width, bitmap.height);
  if (edge <= MAX_IMAGE_EDGE && file.size <= MAX_IMAGE_BYTES) return file;
  const scale = Math.min(1, MAX_IMAGE_EDGE / edge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  return blob ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file;
}

function toReview(draft: PriceDraft): ReviewLine[] {
  return draft.lines.map((l) => ({
    key: l.key,
    description: l.description,
    aiProductId: l.productId,
    suggestions: l.suggestions,
    productId: l.productId ?? "",
    packQuantity: l.packQuantity,
    packUnit: l.packUnit ?? "",
    packLabel: l.packLabel,
    price: l.priceCents === null ? "" : centsToInput(l.priceCents),
    readAs: l.readAs,
    confidence: l.confidence,
    issues: l.issues,
    decision: null,
    error: null,
  }));
}

export function PriceImport({
  products,
  units,
  suppliers,
  disabledReason,
}: {
  products: Product[];
  units: Unit[];
  suppliers: SupplierOption[];
  /** Why reading is off (no database, no AI key), or null. */
  disabledReason: string | null;
}) {
  const index = useMemo(() => new CatalogIndex(products, units), [products, units]);
  const router = useRouter();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, startReading] = useTransition();

  const [draft, setDraft] = useState<PriceDraft | null>(null);
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [vendorChoice, setVendorChoice] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [kind, setKind] = useState<DocumentKind>("price_list");
  const [docDate, setDocDate] = useState("");
  const { pending: saving, run } = useAction();

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  function choose(f: File | undefined) {
    setFileError(null);
    if (!f) return;
    if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) {
      setFileError("Use a PNG, JPG or WebP image (a screenshot works best)");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setDraft(null);
    setLines([]);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function read() {
    if (!file) return;
    startReading(async () => {
      const upload = await prepareImage(file);
      if (upload.size > MAX_IMAGE_BYTES) {
        setFileError(`That image is over ${describeLimit()}. Crop or shrink it.`);
        return;
      }
      const form = new FormData();
      form.set("image", upload);
      let result: Awaited<ReturnType<typeof readPriceScreenshot>>;
      try {
        result = await readPriceScreenshot(form);
      } catch {
        result = { ok: false, error: "Couldn't reach the server. Check your connection." };
      }
      if (!result.ok) {
        setFileError(result.error);
        return;
      }
      const d = result.draft;
      setDraft(d);
      setLines(toReview(d));
      setVendorChoice(d.supplierId ?? (d.vendorName ? OTHER : ""));
      setVendorName(d.supplierId ? "" : d.vendorName);
      setKind(d.documentKind);
      setDocDate(d.documentDate ?? "");
    });
  }

  const update = (key: string, patch: Partial<ReviewLine>) =>
    setLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? {
              ...l,
              ...patch,
              error: null,
              // Editing an approved line puts it back up for review.
              decision: l.decision === "approved" ? null : l.decision,
            }
          : l,
      ),
    );

  /** Same checks the server will run, so a bad line can't be approved. */
  function check(l: ReviewLine): string | null {
    const product = index.products.get(l.productId);
    if (!product) return "Pick the matching product";
    const amount = validateAmount(index, product, l.packQuantity, l.packUnit || "?");
    if (!amount.ok) return l.packUnit ? amount.error : "Pick the pack unit";
    if (parseDollars(l.price) === null) return "Enter the pack price, like 26.89";
    return null;
  }

  function decide(key: string, decision: Decision) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        if (decision !== "approved") return { ...l, decision, error: null };
        const error = check(l);
        return error ? { ...l, error } : { ...l, decision, error: null };
      }),
    );
  }

  function approveClear() {
    setLines((ls) =>
      ls.map((l) =>
        l.decision === null && l.confidence === "high" && check(l) === null
          ? { ...l, decision: "approved" }
          : l,
      ),
    );
  }

  const approved = lines.filter((l) => l.decision === "approved");
  const undecided = lines.filter((l) => l.decision === null).length;
  const clearUndecided = lines.filter(
    (l) => l.decision === null && l.confidence === "high" && check(l) === null,
  ).length;
  const supplier = suppliers.find((s) => s.id === vendorChoice);
  const resolvedVendor = supplier ? supplier.name : vendorChoice === OTHER ? vendorName.trim() : "";

  function save() {
    const payload: PriceImportPayload = {
      vendorName: resolvedVendor,
      supplierId: supplier?.id ?? null,
      documentKind: kind,
      documentDate: docDate || null,
      lines: approved.map((l) => ({
        description: l.description,
        productId: l.productId,
        packQuantity: l.packQuantity,
        packUnit: l.packUnit,
        packLabel: l.packLabel,
        price: l.price,
        confidence: l.confidence,
        mappingMethod: l.productId === l.aiProductId ? "ai_suggested" : "manual",
      })),
    };
    run(
      () => savePriceImport(payload),
      (r) => {
        if (r.ok) {
          reset();
          router.push(r.href ?? "/suppliers/import");
        }
      },
    );
  }

  // ---------------------------------------------------------------------------------------
  // Step 1: pick an image
  // ---------------------------------------------------------------------------------------
  if (!draft) {
    return (
      <section
        aria-labelledby={`${id}-upload`}
        className="bg-card shadow-card rounded-3xl p-5 sm:p-8"
      >
        <h2 id={`${id}-upload`} className="text-lg font-semibold tracking-tight">
          Upload a screenshot
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A price list, invoice, email or text from your rep. PNG, JPG or WebP. Phone photos are
          shrunk before upload.
        </p>
        {disabledReason ? (
          <p role="note" className="bg-warning-soft text-warning mt-4 rounded-xl px-4 py-3 text-sm">
            {disabledReason}
          </p>
        ) : null}
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label
            htmlFor={`${id}-file`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabledReason && !reading) choose(e.dataTransfer.files[0]);
            }}
            className={cn(
              "dots flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "border-border bg-muted/40",
              (disabledReason || reading) && "pointer-events-none opacity-60",
            )}
          >
            <span className="bg-card shadow-raised text-primary mb-4 flex size-12 items-center justify-center rounded-2xl">
              <ImageUp className="size-5" aria-hidden />
            </span>
            <span className="font-medium">
              {file ? "Choose a different image" : "Choose an image"}
            </span>
            <span className="text-muted-foreground mt-1 text-sm">or drop it here</span>
            <input
              ref={fileRef}
              id={`${id}-file`}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              className="sr-only"
              disabled={!!disabledReason || reading}
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>

          <div className="flex flex-col">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never optimized
              <img
                src={preview}
                alt="The screenshot you picked"
                className="max-h-72 w-full rounded-2xl object-contain ring-1 ring-black/5"
              />
            ) : (
              <div className="text-muted-foreground bg-muted/40 flex flex-1 items-center justify-center rounded-2xl p-6 text-sm">
                Your image shows here.
              </div>
            )}
            {fileError ? (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {fileError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={read} disabled={!file || reading || !!disabledReason}>
                {reading ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <ScanText aria-hidden />
                )}
                {reading ? "Reading prices…" : "Read prices"}
              </Button>
              {file && !reading ? (
                <Button type="button" variant="ghost" onClick={reset}>
                  Clear
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-2 text-xs" aria-live="polite">
              {reading ? "This usually takes 10 to 30 seconds." : " "}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------------------
  // Step 2: review every line
  // ---------------------------------------------------------------------------------------
  return (
    <section aria-labelledby={`${id}-review`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="bg-card shadow-card rounded-3xl p-5 sm:p-6">
            <h2 id={`${id}-review`} className="text-lg font-semibold tracking-tight">
              Check what was read
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Fix anything that&apos;s off, then approve or reject each line. Only approved lines
              are saved.
            </p>
            {draft.notes ? (
              <p className="bg-warning-soft text-warning mt-4 rounded-xl px-4 py-2.5 text-sm">
                {draft.notes}
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
                Vendor
                <select
                  className="border-input bg-card h-10 w-full min-w-0 rounded-lg border px-3 text-sm"
                  value={vendorChoice}
                  onChange={(e) => setVendorChoice(e.target.value)}
                >
                  <option value="">Pick the vendor…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={OTHER}>Another vendor…</option>
                </select>
              </label>
              {vendorChoice === OTHER ? (
                <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
                  Vendor name
                  <input
                    className="border-input bg-card h-10 w-full min-w-0 rounded-lg border px-3 text-sm"
                    value={vendorName}
                    maxLength={80}
                    placeholder="e.g. Sunshine Produce"
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </label>
              ) : null}
              <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
                Document
                <select
                  className="border-input bg-card h-10 w-full min-w-0 rounded-lg border px-3 text-sm"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as DocumentKind)}
                >
                  {DOCUMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {DOCUMENT_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
                Date on it
                <input
                  type="date"
                  className="border-input bg-card h-10 w-full min-w-0 rounded-lg border px-3 text-sm"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                />
                <span className="text-muted-foreground font-normal">
                  Blank: dated today, the day you upload it.
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {lines.length} {lines.length === 1 ? "line" : "lines"} · {approved.length} approved
              {undecided ? ` · ${undecided} to review` : ""}
            </p>
            {clearUndecided > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={approveClear}>
                <Sparkles aria-hidden /> Approve {clearUndecided} clear{" "}
                {clearUndecided === 1 ? "line" : "lines"}
              </Button>
            ) : null}
          </div>

          <ol className="mt-3 space-y-3" aria-label="Lines read from the screenshot">
            {lines.map((l, i) => (
              <ReviewLineCard
                key={l.key}
                line={l}
                number={i + 1}
                products={products}
                units={units}
                onChange={(patch) => update(l.key, patch)}
                onDecide={(d) => decide(l.key, d)}
              />
            ))}
          </ol>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never optimized
            <img
              src={preview}
              alt="The screenshot being reviewed"
              className="bg-card order-2 max-h-[28rem] w-full rounded-2xl object-contain ring-1 ring-black/5 lg:order-1"
            />
          ) : null}
          <div className="bg-card shadow-card order-1 rounded-2xl p-4 lg:order-2">
            <Button
              type="button"
              className="w-full"
              onClick={save}
              disabled={saving || approved.length === 0 || !resolvedVendor}
            >
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save {approved.length} approved {approved.length === 1 ? "price" : "prices"}
            </Button>
            <p className="text-muted-foreground mt-2 text-xs">
              {!resolvedVendor
                ? "Pick the vendor first."
                : undecided
                  ? `${undecided} unreviewed ${undecided === 1 ? "line is" : "lines are"} left out.`
                  : "Saved prices show as your quote, dated."}
            </p>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={reset}>
              <RotateCcw aria-hidden /> Start over
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
