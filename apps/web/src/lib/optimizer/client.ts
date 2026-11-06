/**
 * Server-to-server call to the optimizer service (services/optimizer). The browser never
 * calls it directly, so buyer-specific prices never leave our servers.
 */
import type { OptimizeRequest, OptimizeResponse } from "./types";

// Every status the contract allows; `satisfies` fails the build if the generated types change.
const STATUSES = [
  "optimal",
  "partial",
  "infeasible",
] as const satisfies readonly OptimizeResponse["status"][];
type AllStatuses = OptimizeResponse["status"] extends (typeof STATUSES)[number] ? true : never;
const _exhaustive: AllStatuses = true;
void _exhaustive;

export type OptimizerErrorKind = "unavailable" | "rejected" | "failed";

export class OptimizerError extends Error {
  constructor(
    message: string,
    readonly kind: OptimizerErrorKind,
  ) {
    super(message);
    this.name = "OptimizerError";
  }
}

export function optimizerUrl(): string {
  return process.env.OPTIMIZER_URL ?? "http://127.0.0.1:8000";
}

export async function callOptimizer(
  request: OptimizeRequest,
  opts: { url?: string; fetchImpl?: typeof fetch; timeoutMs?: number; apiKey?: string } = {},
): Promise<OptimizeResponse> {
  const {
    url = optimizerUrl(),
    fetchImpl = fetch,
    timeoutMs = 20_000,
    apiKey = process.env.OPTIMIZER_API_KEY,
  } = opts;
  let res: Response;
  try {
    res = await fetchImpl(`${url.replace(/\/+$/, "")}/v1/optimize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Shared secret between the two servers (never sent to the browser).
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new OptimizerError(
      timedOut
        ? "The price optimizer took too long to answer. Please try again."
        : "The price optimizer isn't reachable right now. Please try again in a moment.",
      "unavailable",
    );
  }
  if (res.status === 401) {
    throw new OptimizerError(
      "The price optimizer refused this server's credentials (check OPTIMIZER_API_KEY).",
      "failed",
    );
  }
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof body?.detail === "string" ? body.detail : "the request was invalid";
    throw new OptimizerError(`The optimizer couldn't use this cart: ${detail}.`, "rejected");
  }
  if (!res.ok) {
    throw new OptimizerError(`The price optimizer failed (HTTP ${res.status}).`, "failed");
  }
  const body = (await res.json().catch(() => null)) as OptimizeResponse | null;
  if (!body || !(STATUSES as readonly string[]).includes(body.status)) {
    throw new OptimizerError("The price optimizer sent an unexpected answer.", "failed");
  }
  return body;
}
