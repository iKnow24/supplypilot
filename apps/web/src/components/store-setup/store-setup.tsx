"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  ScanText,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";

import { readSetupFile, saveStoreSetup } from "@/app/(app)/setup/actions";
import { useAction } from "@/components/cart/status";
import { Button } from "@/components/ui/button";
import { prepareImage } from "@/components/vendor-prices/price-import";
import type { Product, Unit } from "@/lib/catalog/schema";
import { CatalogIndex } from "@/lib/cart/validation";
import {
  ACCEPT,
  guessFile,
  MAX_FILES,
  mb,
  sizeLimit,
  unsupportedFileMessage,
  type SetupFile,
} from "@/lib/store-setup/files";
import {
  buildReview,
  removeLine,
  reviewContext,
  setItemProduct,
  toPayload,
  updateDoc,
  updateItem,
  updateLine,
  type Review,
} from "@/lib/store-setup/review";
import { SETUP_DOC_LABEL, type DocumentDraft } from "@/lib/store-setup/types";
import { cn } from "@/lib/utils";

import {
  lineError,
  lineNeedsLook,
  PastOrders,
  ReviewDocuments,
  type SupplierOption,
} from "./review-documents";
import { itemError, itemNeedsLook, ReviewItems } from "./review-items";

type Status = "ready" | "reading" | "read" | "failed";

interface Upload {
  key: string;
  file: File | null;
  name: string;
  kind: SetupFile["kind"] | null;
  status: Status;
  error: string | null;
  draft: DocumentDraft | null;
}

const CONCURRENCY = 3;

const KIND_ICON = { image: FileImage, pdf: FileText, csv: FileSpreadsheet, xlsx: FileSpreadsheet };

function describe(u: Upload): string {
  if (u.status === "reading") return "Reading…";
  if (u.status === "failed") return u.error ?? "Couldn't read it";
  if (u.status === "read" && u.draft) {
    const d = u.draft;
    const vendor = d.vendorName ? ` from ${d.vendorName.replace(" (Demo)", "")}` : "";
    return `${SETUP_DOC_LABEL[d.kind]}${vendor} · ${d.lines.length} ${d.lines.length === 1 ? "line" : "lines"}`;
  }
  return u.kind === "image" ? "Photo" : u.kind === "pdf" ? "PDF" : "Spreadsheet";
}

export function StoreSetup({
  products,
  units,
  suppliers,
  disabledReason,
  setUpBefore,
}: {
  products: Product[];
  units: Unit[];
  suppliers: SupplierOption[];
  disabledReason: string | null;
  /** The store already ran setup once: saving again replaces what it learned. */
  setUpBefore: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const index = useMemo(() => new CatalogIndex(products, units), [products, units]);
  const ctx = useMemo(() => reviewContext(products, units), [products, units]);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { pending: saving, run } = useAction();

  const patch = (key: string, p: Partial<Upload>) =>
    setUploads((us) => us.map((u) => (u.key === key ? { ...u, ...p } : u)));

  function add(list: FileList | null | undefined) {
    if (!list) return;
    const room = MAX_FILES - uploads.length;
    const picked = [...list].slice(0, Math.max(0, room)).map((file): Upload => {
      const kind = guessFile(file.name, file.type);
      const key = `d${nextKey.current++}`;
      const base = { key, file, name: file.name, kind, draft: null };
      if (!kind) return { ...base, status: "failed", error: unsupportedFileMessage(file.name) };
      // Photos are shrunk before upload, so only PDFs and sheets are held to the limit here.
      if (kind !== "image" && file.size > sizeLimit(kind)) {
        return {
          ...base,
          status: "failed",
          error: `Over ${mb(sizeLimit(kind))}. Use a smaller file.`,
        };
      }
      return { ...base, status: "ready", error: null };
    });
    setUploads((us) => [...us, ...picked]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function readOne(u: Upload): Promise<Upload> {
    if (!u.file || !u.kind) return u;
    let upload = u.file;
    if (u.kind === "image") upload = await prepareImage(u.file);
    if (upload.size > sizeLimit(u.kind)) {
      return { ...u, status: "failed", error: `Over ${mb(sizeLimit(u.kind))}. Crop or shrink it.` };
    }
    const form = new FormData();
    form.set("file", upload, u.name);
    form.set("key", u.key);
    try {
      const r = await readSetupFile(form);
      return r.ok
        ? { ...u, status: "read", error: null, draft: r.draft }
        : { ...u, status: "failed", error: r.error, draft: null };
    } catch {
      return { ...u, status: "failed", error: "Couldn't reach the server. Check your connection." };
    }
  }

  async function readAll() {
    const todo = uploads.filter((u) => u.status === "ready" || (u.status === "failed" && u.kind));
    if (!todo.length) return;
    setReading(true);
    const done: Upload[] = [];
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const u = todo[next++]!;
        patch(u.key, { status: "reading", error: null });
        const result = await readOne(u);
        done.push(result);
        patch(u.key, result);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
    setReading(false);
    // Everything read: go straight to the review.
    const all = uploads.map((u) => done.find((d) => d.key === u.key) ?? u);
    if (all.every((u) => u.status === "read")) openReview(all);
  }

  function openReview(list = uploads) {
    const drafts = list.filter((u) => u.status === "read" && u.draft).map((u) => u.draft!);
    if (!drafts.length) return;
    setReview(buildReview(drafts, ctx));
    setSaveError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startOver() {
    setUploads([]);
    setReview(null);
    setSaveError(null);
  }

  const readCount = uploads.filter((u) => u.status === "read").length;
  const waiting = uploads.filter((u) => u.status === "ready").length;
  const failed = uploads.filter((u) => u.status === "failed").length;

  // ---------------------------------------------------------------------------------------
  // Step 1: drop the files, read them
  // ---------------------------------------------------------------------------------------
  if (!review) {
    return (
      <section
        aria-labelledby={`${id}-upload`}
        className="bg-card shadow-card rounded-3xl p-5 sm:p-8"
      >
        <h2 id={`${id}-upload`} className="text-lg font-semibold tracking-tight">
          Add your documents
        </h2>
        <ul className="text-muted-foreground mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <li>· Your inventory count (CSV, Excel or a photo)</li>
          <li>· Invoices from the last few weeks (photos or PDFs)</li>
          <li>· Price sheets or order guides from your vendors</li>
          <li>· Screenshots of texts or emails from your reps</li>
        </ul>
        {disabledReason ? (
          <p role="note" className="bg-warning-soft text-warning mt-4 rounded-xl px-4 py-3 text-sm">
            {disabledReason}
          </p>
        ) : null}
        {setUpBefore ? (
          <p role="note" className="bg-muted mt-4 rounded-xl px-4 py-3 text-sm">
            You&apos;ve set up from documents before. Saving again replaces what was learned last
            time (items, document prices, weekly use and your usual order). Your counts stay.
          </p>
        ) : null}

        <label
          htmlFor={`${id}-files`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabledReason && !reading) add(e.dataTransfer.files);
          }}
          className={cn(
            "dots mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragging ? "border-primary bg-accent" : "border-border bg-muted/40",
            (disabledReason || reading || uploads.length >= MAX_FILES) &&
              "pointer-events-none opacity-60",
          )}
        >
          <span className="bg-card shadow-raised text-primary mb-3 flex size-12 items-center justify-center rounded-2xl">
            <FileUp className="size-5" aria-hidden />
          </span>
          <span className="font-medium">Choose files</span>
          <span className="text-muted-foreground mt-1 text-sm">
            or drop them here · up to {MAX_FILES} · photos, PDFs, CSV or Excel
          </span>
          <input
            ref={fileRef}
            id={`${id}-files`}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={!!disabledReason || reading}
            onChange={(e) => add(e.target.files)}
          />
        </label>

        {uploads.length ? (
          <ul aria-label="Your documents" className="mt-5 divide-y rounded-2xl ring-1 ring-black/5">
            {uploads.map((u) => {
              const Icon = u.kind ? KIND_ICON[u.kind] : CircleAlert;
              return (
                <li key={u.key} className="flex items-center gap-3 px-4 py-3">
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0",
                      u.status === "failed" ? "text-destructive" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span
                      className={cn(
                        "block text-xs",
                        u.status === "failed" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {describe(u)}
                    </span>
                  </span>
                  {u.status === "reading" ? (
                    <Loader2 className="text-primary size-4 animate-spin" aria-label="Reading" />
                  ) : u.status === "read" ? (
                    <CheckCircle2 className="text-success size-4" aria-label="Read" />
                  ) : null}
                  {!reading ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove ${u.name}`}
                      onClick={() => setUploads((us) => us.filter((x) => x.key !== u.key))}
                    >
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {waiting || (failed && !readCount) ? (
            <Button
              type="button"
              size="lg"
              onClick={readAll}
              disabled={reading || !!disabledReason || !uploads.some((u) => u.kind)}
            >
              {reading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <ScanText aria-hidden />
              )}
              {reading
                ? "Reading your documents…"
                : `Read ${waiting || failed} ${waiting + failed === 1 ? "document" : "documents"}`}
            </Button>
          ) : null}
          {readCount && !reading ? (
            <Button
              type="button"
              size="lg"
              variant={waiting ? "outline" : "default"}
              onClick={() => openReview()}
            >
              Review what we found ({readCount} {readCount === 1 ? "document" : "documents"})
            </Button>
          ) : null}
          {failed && readCount && !reading ? (
            <Button type="button" variant="ghost" onClick={readAll}>
              <RotateCcw aria-hidden /> Try the {failed} that failed again
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-2 text-xs" aria-live="polite">
          {reading ? "Each document takes 10 to 40 seconds. They're read at the same time." : " "}
        </p>
      </section>
    );
  }

  // ---------------------------------------------------------------------------------------
  // Step 2: one review screen for everything
  // ---------------------------------------------------------------------------------------
  const itemsByKey = new Map(review.items.map((i) => [i.key, i]));
  const matched = review.items.filter((i) => i.productId);
  const unmatched = review.items.length - matched.length;
  const toLook =
    matched.filter((i) => itemNeedsLook(i, index)).length +
    review.docs
      .flatMap((d) => d.lines)
      .filter((l) => lineNeedsLook(l, itemsByKey.get(l.itemKey), index)).length;
  const blocking = [
    ...matched.map((i) => itemError(i, index)),
    ...review.docs.flatMap((d) => [
      !d.supplierId && !d.vendorName.trim() ? `${d.fileName}: name the vendor` : null,
      ...d.lines.map((l) => lineError(l, itemsByKey.get(l.itemKey), index)),
    ]),
  ].filter(Boolean).length;
  const counted = matched.filter((i) => i.onHand).length;
  const withUse = matched.filter((i) => Number(i.weekly) > 0).length;
  const invoices = review.docs.filter((d) => d.kind === "invoice").length;
  const supplierName = (sid: string) => suppliers.find((s) => s.id === sid)?.name;

  function save() {
    if (!review) return;
    setSaveError(null);
    run(
      () => saveStoreSetup(toPayload(review, supplierName)),
      (r) => {
        if (r.ok) router.push(r.href ?? "/home");
        else setSaveError(r.error);
      },
    );
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby={`${id}-summary`}
        className="bg-card shadow-card rounded-3xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={`${id}-summary`} className="text-lg font-semibold tracking-tight">
              Here&apos;s what we found
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              From {readCount} {readCount === 1 ? "document" : "documents"}. Nothing is saved until
              you say so.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setReview(null)}>
            <RotateCcw aria-hidden /> Add or remove files
          </Button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [
              "Items",
              `${matched.length}`,
              unmatched ? `+${unmatched} not matched yet` : "all matched",
            ],
            ["Counted", `${counted}`, "on hand from your count"],
            [
              "Weekly use",
              `${withUse}`,
              `from ${invoices} ${invoices === 1 ? "invoice" : "invoices"}`,
            ],
            ["To check", `${toLook}`, toLook ? "marked in amber" : "looks clear"],
          ].map(([label, value, sub]) => (
            <div key={label} className="bg-muted/50 rounded-2xl px-4 py-3">
              <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
              <dd className="font-display tabular text-2xl font-medium">{value}</dd>
              <dd className="text-muted-foreground text-xs">{sub}</dd>
            </div>
          ))}
        </dl>
        {review.countNotes.map((n) => (
          <p key={n} className="bg-warning-soft text-warning mt-3 rounded-xl px-3 py-2 text-sm">
            {n}
          </p>
        ))}
      </section>

      <ReviewItems
        items={review.items}
        products={products}
        index={index}
        onProduct={(key, pid) => setReview((r) => (r ? setItemProduct(r, key, pid, ctx) : r))}
        onChange={(key, p) => setReview((r) => (r ? updateItem(r, key, p, ctx) : r))}
      />

      {review.docs.length ? (
        <ReviewDocuments
          docs={review.docs}
          items={review.items}
          index={index}
          units={units}
          suppliers={suppliers}
          onDoc={(dk, p) => setReview((r) => (r ? updateDoc(r, dk, p, ctx) : r))}
          onLine={(dk, lk, p) => setReview((r) => (r ? updateLine(r, dk, lk, p, ctx) : r))}
          onRemoveLine={(dk, lk) => setReview((r) => (r ? removeLine(r, dk, lk, ctx) : r))}
        />
      ) : null}

      <PastOrders docs={review.docs} suppliers={suppliers} />

      <div className="bg-card/90 shadow-raised sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 backdrop-blur md:bottom-4">
        <p className="text-sm" aria-live="polite">
          {saveError ? (
            <span role="alert" className="text-destructive">
              {saveError}
            </span>
          ) : blocking ? (
            <span className="text-destructive">
              {blocking} {blocking === 1 ? "thing needs" : "things need"} fixing before you save.
            </span>
          ) : (
            <span className="text-muted-foreground hidden sm:inline">
              Saves {matched.length} items
              {review.docs.length
                ? `, prices from ${review.docs.length} ${review.docs.length === 1 ? "document" : "documents"}`
                : ""}{" "}
              and your usual order. Your files aren&apos;t kept.
            </span>
          )}
        </p>
        <span className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button type="button" variant="ghost" onClick={startOver} disabled={saving}>
            Start over
          </Button>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            onClick={save}
            disabled={saving || blocking > 0 || !matched.length}
          >
            {saving ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 aria-hidden />
            )}
            Save and set up my store
          </Button>
        </span>
      </div>
    </div>
  );
}
