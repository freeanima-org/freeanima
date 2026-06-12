import { webuiCtx } from "./runtime.ts";

export async function listSelfBlocks() {
  return webuiCtx().listSelfBlocks();
}
