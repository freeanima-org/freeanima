import type { FridgeMagnetsResponse } from "@freeanima/connectors-webui/api";
import { webuiCtx } from "./runtime.ts";

export async function listFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  return webuiCtx().listFridgeMagnets();
}
