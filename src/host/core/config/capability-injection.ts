import type { Logger } from "@freeanima/host/kernel/logging";
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

let injection: CapabilityInjection = {};

/** Composition root wires platform config helpers for capabilities packages */
export function registerCapabilityInjection(next: CapabilityInjection): void {
  injection = { ...injection, ...next };
}

export function resetCapabilityInjectionForTest(): void {
  injection = {};
}

export async function vaultForCapability(itemId: number, field: string): Promise<string> {
  if (!injection.vault) {
    throw new Error("vault not registered; call registerCapabilityInjection at composition root");
  }
  return injection.vault(itemId, field);
}

export function readAppVersionForCapability(repoRoot?: string): string {
  if (injection.readAppVersion) {
    return injection.readAppVersion(repoRoot);
  }
  return readAppVersion(repoRoot);
}

export function logCapability(component: string): Logger {
  return getRuntimeLogger().with({ component });
}
