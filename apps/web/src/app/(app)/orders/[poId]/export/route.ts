/**
 * Download a PO as CSV or PDF. Read-only: marking it Exported happens in the
 * exportPurchaseOrder action just before the browser requests this, so a prefetch or a
 * crawler can never change a PO's status.
 */
import { getRepository } from "@/lib/catalog/seed-repository";
import { purchaseOrderCsv, purchaseOrderFilename } from "@/lib/orders/export-csv";
import { purchaseOrderPdf } from "@/lib/orders/export-pdf";
import { getSession } from "@/lib/session";

export async function GET(request: Request, { params }: RouteContext<"/orders/[poId]/export">) {
  const { poId } = await params;
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "pdf")
    return new Response("format must be csv or pdf", { status: 400 });

  const { buyer, state } = await getSession();
  if (!state) return new Response("Not signed in", { status: 401 });
  const po = await state.getPurchaseOrder(poId);
  if (!po) return new Response("Not found", { status: 404 });

  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${purchaseOrderFilename(po, format)}"`,
  };
  if (format === "csv") {
    return new Response(purchaseOrderCsv(po, buyer.name), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const source = await getRepository().source();
  const pdf = await purchaseOrderPdf(po, buyer.name, {
    synthetic: source.synthetic,
    dataLabel: source.label,
  });
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: { ...headers, "Content-Type": "application/pdf" },
  });
}
