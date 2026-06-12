import type { AnimaService } from "@freeanima/service-api";
import { webuiCtx } from "./runtime.ts";

export function createSelfHandlers(service: AnimaService) {
  return {
    listSelfBlocks: () => service.listSelfBlocks(),
  };
}

type SelfHandlers = ReturnType<typeof createSelfHandlers>;

let handlers: SelfHandlers | null = null;

function selfHandlers(): SelfHandlers {
  if (!handlers) {
    handlers = createSelfHandlers(webuiCtx().service);
  }
  return handlers;
}

export async function listSelfBlocks() {
  return selfHandlers().listSelfBlocks();
}

export function resetSelfHandlersForTests(): void {
  handlers = null;
}
