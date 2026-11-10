/**
 * A stand-in for the Anthropic Messages API, so e2e tests never call the real AI (or need a
 * key). The web app talks to it through the real SDK via ANTHROPIC_BASE_URL, so request
 * building and structured-output parsing are exercised for real.
 *
 * It answers every request with the reading of e2e/fixtures/price-text.png, after checking the
 * request carries an image and an output schema like the app sends.
 *   node e2e/mock-anthropic.mjs [port]
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? process.env.MOCK_ANTHROPIC_PORT ?? 4010);

export const READING = {
  is_price_document: true,
  vendor_name: "Bramblewood Baking Supply",
  document_kind: "text_message",
  document_date: "2026-11-08",
  notes: null,
  lines: [
    {
      description: "AP flour unbleached 50# — .42/lb",
      product_id: "prd_flour_ap_unbl",
      pack_quantity: "50",
      pack_unit: "lb",
      pack_label: "50 lb bag",
      price: "0.42",
      price_per: "unit",
      confidence: "high",
    },
    {
      description: "Bread flour hi-gluten 50# $24.75",
      product_id: "prd_flour_bread",
      pack_quantity: "50",
      pack_unit: "lb",
      pack_label: "50 lb bag",
      price: "24.75",
      price_per: "pack",
      confidence: "high",
    },
    {
      description: "Semi-sweet chips 25# $89.00",
      product_id: "prd_choc_chips",
      pack_quantity: "25",
      pack_unit: "lb",
      pack_label: "25 lb case",
      price: "89.00",
      price_per: "pack",
      confidence: "medium",
    },
    {
      description: "Pure vanilla 32oz $78",
      product_id: null,
      pack_quantity: "32",
      pack_unit: "fl_oz",
      pack_label: "32 fl oz bottle",
      price: "78.00",
      price_per: "pack",
      confidence: "low",
    },
  ],
};

function reply(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return reply(res, 200, { ok: true });
  if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
    return reply(res, 404, { type: "error", error: { type: "not_found_error", message: "nope" } });
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    const content = body.messages?.[0]?.content ?? [];
    const hasImage = content.some((b) => b.type === "image" && b.source?.data);
    if (!hasImage || body.output_config?.format?.type !== "json_schema") {
      return reply(res, 400, {
        type: "error",
        error: { type: "invalid_request_error", message: "expected an image and a schema" },
      });
    }
    reply(res, 200, {
      id: "msg_mock",
      type: "message",
      role: "assistant",
      model: body.model,
      content: [{ type: "text", text: JSON.stringify(READING) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 300 },
    });
  });
}).listen(port, "127.0.0.1", () => console.log(`mock Anthropic API on :${port}`));
