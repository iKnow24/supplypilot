/**
 * A stand-in for the Anthropic Messages API, so e2e tests never call the real AI (or need a
 * key). The web app talks to it through the real SDK via ANTHROPIC_BASE_URL, so request
 * building and structured-output parsing are exercised for real.
 *
 * Three kinds of request:
 *  - price screenshots (an image + an output schema): answers with the reading of
 *    e2e/fixtures/price-text.png;
 *  - store setup documents (streamed, an output schema with is_relevant): answers with the
 *    reading of the fixture file named in the prompt (e2e/fixtures/setup/documents.mjs), or
 *    "nothing relevant" for any other file;
 *  - Autopilot (tools): plays a fixed agent, one tool step per turn, based on which tools have
 *    already returned: check_stock -> draft_order -> check_vendor_quotes + price_order
 *    (in parallel) -> present_plan.
 *   node e2e/mock-anthropic.mjs [port]
 */
import { createServer } from "node:http";

import { READINGS } from "./fixtures/setup/documents.mjs";

const port = Number(process.argv[2] ?? process.env.MOCK_ANTHROPIC_PORT ?? 4010);
// Optional pause before each Autopilot turn, to watch the steps arrive (screenshots, demos).
const agentDelayMs = Number(process.env.MOCK_AI_DELAY_MS ?? 0);
// Optional pause before each setup document's answer (to see "Reading…").
const setupDelayMs = Number(process.env.MOCK_SETUP_DELAY_MS ?? 0);

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

/** The next Autopilot turn, from the tool results so far. */
function agentTurn(body) {
  const names = new Map(); // tool_use id -> name
  const results = new Map(); // name -> parsed result
  for (const m of body.messages) {
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type === "tool_use") names.set(b.id, b.name);
      if (b.type === "tool_result") {
        let parsed = null;
        try {
          parsed = JSON.parse(b.content);
        } catch {}
        results.set(names.get(b.tool_use_id), parsed);
      }
    }
  }
  const turn = names.size;
  const callTool = (name, input) => ({
    type: "tool_use",
    id: `toolu_${turn}_${name}`,
    name,
    input,
  });
  let content;
  if (!results.has("check_stock")) {
    content = [{ type: "text", text: "Checking the pantry first." }, callTool("check_stock", {})];
  } else if (!results.has("draft_order")) {
    const date = results.get("check_stock")?.planned_for ?? "2026-11-10";
    content = [callTool("draft_order", { delivery_date: date, remove_product_ids: [] })];
  } else if (!results.has("price_order")) {
    content = [callTool("check_vendor_quotes", {}), callTool("price_order", {})];
  } else {
    content = [
      callTool("present_plan", {
        headline: "Your next order is priced and ready to approve",
        notes: ["Split across suppliers so each one's minimum is met.", "Nothing was left out."],
      }),
    ];
  }
  return {
    id: `msg_agent_${turn}`,
    type: "message",
    role: "assistant",
    model: body.model,
    content,
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 2000, output_tokens: 120 },
  };
}

/** A store-setup document: the reading of the fixture named in the prompt, streamed. */
function setupReading(body, res) {
  const content = body.messages?.[0]?.content ?? [];
  const prompt = content.find((b) => b.type === "text")?.text ?? "";
  const name = prompt.match(/The file is named "([^"]+)"/)?.[1] ?? "";
  const source = content.find((b) => b.type === "image" || b.type === "document");
  if (!source) {
    return reply(res, 400, {
      type: "error",
      error: { type: "invalid_request_error", message: "expected a document" },
    });
  }
  const reading = READINGS[name] ?? {
    document_kind: "other",
    is_relevant: false,
    vendor_name: null,
    document_date: null,
    notes: null,
    lines: [],
  };
  const text = JSON.stringify(reading);
  const message = {
    id: `msg_setup_${name}`,
    type: "message",
    role: "assistant",
    model: body.model,
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 1500, output_tokens: 1 },
  };
  const events = [
    ["message_start", { type: "message_start", message }],
    [
      "content_block_start",
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ],
    [
      "content_block_delta",
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    ],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 400 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ];
  setTimeout(() => {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    for (const [event, data] of events)
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    res.end();
  }, setupDelayMs);
}

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
    if (Array.isArray(body.tools) && body.tools.some((t) => t.name === "check_stock")) {
      return setTimeout(() => reply(res, 200, agentTurn(body)), agentDelayMs);
    }
    if (body.output_config?.format?.schema?.properties?.is_relevant) {
      return setupReading(body, res);
    }
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
