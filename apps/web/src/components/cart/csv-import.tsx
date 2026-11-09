"use client";

import { Download, FileUp } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { importCartLines } from "@/app/(app)/cart/actions";
import { Button } from "@/components/ui/button";
import type { Product, Unit } from "@/lib/catalog/schema";
import { CSV_MAX_BYTES, parseCartCsv, type CsvResult } from "@/lib/cart/csv";
import { CatalogIndex } from "@/lib/cart/validation";
import { unitShortLabel } from "@/lib/units";

import { useAction } from "./status";

export function CsvImport({
  products,
  units,
  cartHasLines,
}: {
  products: Product[];
  units: Unit[];
  cartHasLines: boolean;
}) {
  const index = useMemo(() => new CatalogIndex(products, units), [products, units]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<CsvResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const { pending, run } = useAction();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    if (file.size > CSV_MAX_BYTES) {
      setResult({
        lines: [],
        errors: [],
        skipped: 0,
        fatal: `File is larger than ${CSV_MAX_BYTES / 1024} KB`,
      });
      return;
    }
    setResult(parseCartCsv(await file.text(), index));
  }

  function reset() {
    setResult(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(mode: "merge" | "replace") {
    if (!result?.lines.length) return;
    const lines = result.lines.map(({ product_id, quantity, unit }) => ({
      product_id,
      quantity,
      unit,
    }));
    run(
      () => importCartLines(lines, mode),
      (r) => r.ok && reset(),
    );
  }

  const n = result?.lines.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href="/cart/template.csv" download>
            <Download aria-hidden /> Download template
          </a>
        </Button>
        <label
          htmlFor={id}
          className="border-input bg-card hover:bg-muted has-focus-visible:outline-ring inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-medium has-focus-visible:outline-2"
        >
          <FileUp className="size-4" aria-hidden /> Choose CSV file
          <input
            ref={fileRef}
            id={id}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {fileName ? <span className="text-muted-foreground text-xs">{fileName}</span> : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Columns: <code className="font-mono">product</code> (id or exact name),{" "}
        <code className="font-mono">quantity</code>, <code className="font-mono">unit</code>{" "}
        (optional). Rows with a blank quantity are skipped.
      </p>

      {result?.fatal ? (
        <p
          role="alert"
          className="bg-destructive-soft text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {result.fatal}
        </p>
      ) : null}

      {result && !result.fatal ? (
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm">
            <strong className="font-semibold">{n}</strong> row{n === 1 ? "" : "s"} ready
            {result.errors.length ? (
              <>
                , <strong className="text-destructive font-semibold">{result.errors.length}</strong>{" "}
                with problems
              </>
            ) : null}
            {result.skipped ? `, ${result.skipped} skipped (blank quantity)` : ""}.
          </p>

          {result.errors.length ? (
            <div className="max-h-56 overflow-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Rows that can&apos;t be imported</caption>
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th scope="col" className="px-3 py-1.5 font-medium">
                      Line
                    </th>
                    <th scope="col" className="px-3 py-1.5 font-medium">
                      Problem
                    </th>
                    <th scope="col" className="hidden px-3 py-1.5 font-medium sm:table-cell">
                      Row content
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.errors.map((e) => (
                    <tr key={e.row}>
                      <td className="tabular px-3 py-1.5">{e.row}</td>
                      <td className="text-destructive px-3 py-1.5">{e.message}</td>
                      <td className="text-muted-foreground hidden max-w-48 truncate px-3 py-1.5 font-mono sm:table-cell">
                        {e.raw}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {n ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-medium">
                Preview the {n} valid rows
              </summary>
              <ul className="text-muted-foreground mt-2 max-h-40 space-y-0.5 overflow-auto text-xs">
                {result.lines.map((l) => (
                  <li key={l.product_id}>
                    {l.productName}: <span className="tabular">{l.quantity}</span>{" "}
                    {unitShortLabel(l.unit)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!n || pending} onClick={() => submit("merge")}>
              {cartHasLines ? `Add ${n} to cart` : `Import ${n} item${n === 1 ? "" : "s"}`}
            </Button>
            {cartHasLines ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!n || pending}
                onClick={() => submit("replace")}
              >
                Replace cart with these {n}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
          {result.errors.length && n ? (
            <p className="text-muted-foreground text-xs">
              Rows with problems are left out. Fix them in your spreadsheet and upload again, or add
              those items with search.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
