import type { EntityStorePort } from "@freeanima/core/repos";
import { ENTITY_ROOT_WORLD_ID } from "@freeanima/core/db/schema";

import { syncEntityTasksSummary, type FridgeBridge } from "./fridge-bridge.ts";
import type { TaskItemRow } from "./types.ts";

let store: EntityStorePort | null = null;
let fridgeBridge: FridgeBridge | undefined;

export function registerEntityTaskModule(opts: {
  entityStore: EntityStorePort;
  fridgeBridge?: FridgeBridge;
}): void {
  store = opts.entityStore;
  fridgeBridge = opts.fridgeBridge;
}

export function getEntityStoreForTask(): EntityStorePort {
  if (!store) throw new Error("entity task module not registered");
  return store;
}

export function getTaskFridgeBridge(): FridgeBridge | undefined {
  return fridgeBridge;
}

export function defaultTaskWorldId(): number {
  return ENTITY_ROOT_WORLD_ID;
}

export async function syncAfterTaskMutation(items: TaskItemRow[]): Promise<void> {
  await syncEntityTasksSummary(items, fridgeBridge);
}

export function resetEntityTaskModuleForTests(): void {
  store = null;
  fridgeBridge = undefined;
}

export type { FridgeBridge };
