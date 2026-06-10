import type { FridgeMagnetsResponse } from "@freeanima/connectors-webui/api";
import type { RuntimeService } from "@freeanima/service-api/runtime-service";
import { webuiCtx } from "./runtime.ts";

export function createFridgeHandlers(service: RuntimeService) {
  return {
    listFridgeMagnets: (): Promise<FridgeMagnetsResponse> => service.listFridgeMagnets(),
  };
}

type FridgeHandlers = ReturnType<typeof createFridgeHandlers>;

let handlers: FridgeHandlers | null = null;

function fridgeHandlers(): FridgeHandlers {
  if (!handlers) {
    handlers = createFridgeHandlers(webuiCtx().service);
  }
  return handlers;
}

export async function listFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  return fridgeHandlers().listFridgeMagnets();
}

export function resetFridgeHandlersForTests(): void {
  handlers = null;
}
