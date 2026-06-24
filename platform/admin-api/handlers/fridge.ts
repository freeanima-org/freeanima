import type { FridgeMagnetsResponse } from "@freeanima/admin-api/api";
import { adminCtx } from "./runtime.ts";

export async function listFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  return adminCtx().listFridgeMagnets();
}
