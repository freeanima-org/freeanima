import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import {
  mountTokenizerResolveContextService,
  type TokenizerResolveContextService,
} from "./resolve-context-service.ts";

export type ResolveContext = {
  ollamaBaseUrls?: string[];
};

function service(): TokenizerResolveContextService {
  return mountTokenizerResolveContextService(ensureProcessContext());
}

export function setResolveContext(ctx: ResolveContext): void {
  service().set(ctx);
}

export function getResolveContext(): ResolveContext {
  return getProcessContext()?.tokenizerResolveContext?.get() ?? {};
}

export function resetResolveContextForTest(): void {
  getProcessContext()?.tokenizerResolveContext?.reset();
}
