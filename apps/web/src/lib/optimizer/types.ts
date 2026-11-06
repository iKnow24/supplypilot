/**
 * Friendly names for the optimizer contract. api-types.ts is GENERATED from the Python
 * models (make api-types); never edit it by hand.
 */
import type { components } from "./api-types";

type S = components["schemas"];

export type OptimizeRequest = S["OptimizeRequest"];
export type OptimizeResponse = S["OptimizeResponse"];
export type Plan = S["Plan"];
export type SupplierOrder = S["SupplierOrder"];
export type PlanLine = S["PlanLine"];
export type Allocation = S["Allocation"];
export type Alternative = S["Alternative"];
export type Baseline = S["Baseline"];
export type Problem = S["Problem"];
export type ExcludedOffer = S["ExcludedOffer"];
