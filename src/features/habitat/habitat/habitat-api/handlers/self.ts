import { habitatCtx } from "./runtime.ts";

export async function listSelfBlocks() {
  return habitatCtx().listSelfBlocks();
}
