import { adminCtx } from "./runtime.ts";

export async function listSelfBlocks() {
  return adminCtx().listSelfBlocks();
}
