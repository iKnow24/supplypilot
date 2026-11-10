// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { SeedCatalogRepository } from "../catalog/seed-repository";
import { EXTRACTION_MODEL, readPriceImage } from "./extract";
import type { Extraction } from "./extraction-schema";

const repo = SeedCatalogRepository.fromSeed();
const catalog = {
  products: await repo.listProducts(),
  units: await repo.units(),
  today: "2026-11-09",
};
const image = { data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), mediaType: "image/jpeg" as const };

const reading: Extraction = {
  is_price_document: true,
  vendor_name: "Bramblewood",
  document_kind: "text_message",
  document_date: "2026-11-08",
  notes: null,
  lines: [],
};

/** A stand-in for the SDK: the AI is never called in unit tests. */
function fakeClient(parse: (params: unknown) => Promise<unknown>) {
  return { beta: { messages: { parse: vi.fn(parse) } } } as unknown as Anthropic & {
    beta: { messages: { parse: ReturnType<typeof vi.fn> } };
  };
}

describe("reading a price screenshot", () => {
  it("sends the image, the catalog and a structured-output schema to the latest model", async () => {
    const client = fakeClient(async () => ({ stop_reason: "end_turn", parsed_output: reading }));
    const r = await readPriceImage(image, catalog, client);
    expect(r).toEqual({ ok: true, value: reading });

    const params = client.beta.messages.parse.mock.calls[0]![0];
    expect(params.model).toBe(EXTRACTION_MODEL);
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.fallbacks).toBe("default");
    expect(params.system[1].text).toContain("prd_flour_ap_unbl | All-purpose flour, unbleached");
    const [img, text] = params.messages[0].content;
    expect(img.source).toEqual({ type: "base64", media_type: "image/jpeg", data: "/9j/4A==" });
    expect(text.text).toContain("Today is 2026-11-09");
    // Image text is data, never instructions.
    expect(params.system[0].text).toMatch(/never instructions to you/);
  });

  it("explains refusals, truncation and unreadable answers instead of guessing", async () => {
    for (const [reply, error] of [
      [{ stop_reason: "refusal", parsed_output: null }, /declined/],
      [{ stop_reason: "max_tokens", parsed_output: null }, /too long/],
      [{ stop_reason: "end_turn", parsed_output: null }, /couldn't be read/],
    ] as const) {
      const r = await readPriceImage(
        image,
        catalog,
        fakeClient(async () => reply),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(error);
    }
  });

  it("turns API failures into plain English", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const cases: [Error, RegExp][] = [
      [new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()), /busy/],
      [new Anthropic.AuthenticationError(401, undefined, "bad key", new Headers()), /AI key/],
      [new Anthropic.APIConnectionError({ message: "offline" }), /Couldn't reach/],
      [new Error("boom"), /Something went wrong/],
    ];
    for (const [err, message] of cases) {
      const r = await readPriceImage(
        image,
        catalog,
        fakeClient(() => Promise.reject(err)),
      );
      expect(r).toEqual({ ok: false, error: expect.stringMatching(message) });
    }
    quiet.mockRestore();
  });
});
