import { cartCsvTemplate } from "@/lib/cart/csv";
import { getRepository } from "@/lib/catalog/seed-repository";

/** CSV template: every catalog product with its default unit and a blank quantity. */
export async function GET() {
  const products = await getRepository().listProducts();
  return new Response(cartCsvTemplate(products), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="supplypilot-cart-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
