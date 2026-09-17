import type { Logger } from "@freeanima/kernel/logging";
import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import {
  mountCapabilityInjectionService,
  type CapabilityInjectionService,
} from "./capability-injection-service.ts";
import { getRuntimeLogger } from "./runtime-logger.ts";
import { readAppVersion } from "./version.ts";

export type VaultMeta = {
  id: number;
  title: string;
  item_type: string;
  custom_field_names: string[];
};

export type CapabilityInjection = {
  vault?: (itemId: number, field: string) => Promise<string>;
  readAppVersion?: (repoRoot?: string) => string;
};

function capabilityInjectionService(): CapabilityInjectionService {
  return mountCapabilityInjectionService(ensureRootContext());
}

function capabilityInjection(): CapabilityInjection {
  return getRootContextOrNull()?.capabilityInjection?.get() ?? {};
}

/** Composition root wires platform config helpers for capabilities packages */
export function registerCapabilityInjection(next: CapabilityInjection): void {
  capabilityInjectionService().register(next);
}

export function resetCapabilityInjectionForTest(): void {
  getRootContextOrNull()?.capabilityInjection?.reset();
}

export async function vaultForCapability(itemId: number, field: string): Promise<string> {
  const injection = capabilityInjection();
  if (!injection.vault) {
    throw new Error("vault not registered; call registerCapabilityInjection at composition root");
  }
  return injection.vault(itemId, field);
}

export function readAppVersionForCapability(repoRoot?: string): string {
  const injection = capabilityInjection();
  if (injection.readAppVersion) {
    return injection.readAppVersion(repoRoot);
  }
  return readAppVersion(repoRoot);
}

export function logCapability(component: string): Logger {
  return getRuntimeLogger().with({ component });
}
