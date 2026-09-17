import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import {
  mountTokenizerResolveContextService,
  type TokenizerResolveContextService,
} from "./resolve-context-service.ts";

export type ResolveContext = {
  ollamaBaseUrls?: string[];
};

function service(): TokenizerResolveContextService {
  return mountTokenizerResolveContextService(ensureRootContext());
}

export function setResolveContext(ctx: ResolveContext): void {
  service().set(ctx);
}

export function getResolveContext(): ResolveContext {
  return getRootContextOrNull()?.tokenizerResolveContext?.get() ?? {};
}

export function resetResolveContextForTest(): void {
  getRootContextOrNull()?.tokenizerResolveContext?.reset();
}
