import type { z } from "zod";

import { chatMethodDefs } from "./chat.ts";
import { consoleMethodDefs } from "./console.ts";
import {
  diaryMethodDefs,
  dreamMethodDefs,
  emailMethodDefs,
  notificationMethodDefs,
  companionMethodDefs,
} from "./features.ts";
import { mcpMethodDefs } from "./mcp.ts";
import { taskMethodDefs } from "./task.ts";
import { vaultMethodDefs } from "./vault.ts";
import { wsOnlyMethodDefs } from "./ws-only.ts";
import type { HubMethodDef } from "../method-def.ts";

const REGISTRY_PARTS = [
  chatMethodDefs,
  taskMethodDefs,
  vaultMethodDefs,
  emailMethodDefs,
  diaryMethodDefs,
  dreamMethodDefs,
  notificationMethodDefs,
  companionMethodDefs,
  wsOnlyMethodDefs,
  mcpMethodDefs,
  consoleMethodDefs,
] as const;

function assertNoDuplicateRegistry(): void {
  const seen = new Set<string>();
  for (const part of REGISTRY_PARTS) {
    for (const method of Object.keys(part)) {
      if (seen.has(method)) {
        throw new Error(`duplicate hub method registry entry: ${method}`);
      }
      seen.add(method);
    }
  }
}

assertNoDuplicateRegistry();

export const METHOD_REGISTRY = {
  ...chatMethodDefs,
  ...taskMethodDefs,
  ...vaultMethodDefs,
  ...emailMethodDefs,
  ...diaryMethodDefs,
  ...dreamMethodDefs,
  ...notificationMethodDefs,
  ...companionMethodDefs,
  ...wsOnlyMethodDefs,
  ...mcpMethodDefs,
  ...consoleMethodDefs,
} as const;

export type HubMethod = keyof typeof METHOD_REGISTRY;

export type HubMethodInputs = {
  [K in HubMethod]: z.infer<(typeof METHOD_REGISTRY)[K]["input"]>;
};

export type HubMethodOutputs = {
  [K in HubMethod]: z.infer<(typeof METHOD_REGISTRY)[K]["output"]>;
};

export function isHubMethod(method: string): method is HubMethod {
  return method in METHOD_REGISTRY;
}

export function getHubMethodDef(method: HubMethod): HubMethodDef {
  return METHOD_REGISTRY[method];
}

export function listHubMethods(): HubMethod[] {
  return Object.keys(METHOD_REGISTRY) as HubMethod[];
}
