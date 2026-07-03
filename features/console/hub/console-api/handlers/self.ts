import { consoleCtx } from "./runtime.ts";

export async function listSelfBlocks() {
  return consoleCtx().listSelfBlocks();
}
