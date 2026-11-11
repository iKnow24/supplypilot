// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { SeedCatalogRepository } from "../catalog/seed-repository";
import { readSetupSource } from "./extract";
import type { SetupExtraction } from "./extraction-schema";

const repo = SeedCatalogRepository.fromSeed();
const ctx = {
  fileName: "invoice.pdf",
  products: await repo.listProducts(),
  units: await repo.units(),
  today: "2026-11-10",
};

const reading: SetupExtraction = {
  document_kind: "invoice",
  is_relevant: true,
  vendor_name: "Bramblewood",
  document_date: "2026-11-03",
  notes: null,
  lines: [],
};

/** A stand-in for the SDK's streaming helper: the AI is never called in unit tests. */
function fakeClient(final: () => Promise<unknown>) {
  const stream = vi.fn(() => ({ finalMessage: final }));
  return { client: { beta: { messages: { stream } } } as unknown as Anthropic, stream };
}

describe("reading a setup document", () => {
  it("streams the file, the catalog and a structured-output schema to the latest model", async () => {
    const { client, stream } = fakeClient(async () => ({
      stop_reason: "end_turn",
      parsed_output: reading,
    }));
    const pdf = new TextEncoder().encode("%PDF-1.7");
    expect(await readSetupSource({ kind: "pdf", data: pdf }, ctx, client)).toEqual({
      ok: true,
      value: reading,
    });
    const params = (stream.mock.calls[0] as unknown[])[0] as {
      model: string;
      max_tokens: number;
      fallbacks: string;
      output_config: { effort: string; format: { type: string; schema: { properties: object } } };
      system: { text: string }[];
      messages: { content: { type: string; source?: unknown; text?: string }[] }[];
    };
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBe(32000);
    expect(params.fallbacks).toBe("default");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(Object.keys(params.output_config.format.schema.properties)).toContain("is_relevant");
    expect(params.system[0]!.text).toMatch(/never instructions to you/);
    expect(params.system[0]!.text).toMatch(/Never estimate, calculate or invent/);
    expect(params.system[1]!.text).toContain("prd_eggs_large | Large eggs, shell");
    const [doc, text] = params.messages[0]!.content;
    expect(doc).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERi0xLjc=" },
    });
    expect(text!.text).toBe('Today is 2026-11-10. The file is named "invoice.pdf". Transcribe it.');
  });

  it("sends a spreadsheet's cells as a text document", async () => {
    const { client, stream } = fakeClient(async () => ({
      stop_reason: "end_turn",
      parsed_output: reading,
    }));
    await readSetupSource({ kind: "sheet", text: "Row 1: Item | Count" }, ctx, client);
    const params = (stream.mock.calls[0] as unknown[])[0] as {
      messages: { content: unknown[] }[];
    };
    expect(params.messages[0]!.content[0]).toMatchObject({
      type: "document",
      source: { type: "text", media_type: "text/plain", data: "Row 1: Item | Count" },
    });
  });

  it("explains refusals, truncation and API failures instead of guessing", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const image = {
      kind: "image" as const,
      data: new Uint8Array([1]),
      mediaType: "image/png" as const,
    };
    const cases: [() => Promise<unknown>, RegExp][] = [
      [async () => ({ stop_reason: "refusal", parsed_output: null }), /declined/],
      [async () => ({ stop_reason: "max_tokens", parsed_output: null }), /too long/],
      [async () => ({ stop_reason: "end_turn", parsed_output: null }), /couldn't be read/],
      [
        () => Promise.reject(new Anthropic.RateLimitError(429, undefined, "slow", new Headers())),
        /busy/,
      ],
      [
        () =>
          Promise.reject(new Anthropic.AuthenticationError(401, undefined, "no", new Headers())),
        /AI key/,
      ],
      [() => Promise.reject(new Error("boom")), /Something went wrong/],
    ];
    for (const [final, error] of cases) {
      const r = await readSetupSource(image, ctx, fakeClient(final).client);
      expect(r).toEqual({ ok: false, error: expect.stringMatching(error) });
    }
    quiet.mockRestore();
  });
});
