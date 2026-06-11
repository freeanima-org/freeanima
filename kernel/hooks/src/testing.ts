import { createTestLogger } from "@freeanima/kernel-logging/testing";
import { HookRegistry } from "./registry.ts";

export function createTestHookRegistry(): HookRegistry {
  return new HookRegistry(createTestLogger());
}
