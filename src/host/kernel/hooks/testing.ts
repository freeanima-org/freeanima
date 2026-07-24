import { createTestLogger } from "../logging/testing.ts";
import { HookRegistry } from "./registry.ts";

export function createTestHookRegistry(): HookRegistry {
  return new HookRegistry(createTestLogger());
}
