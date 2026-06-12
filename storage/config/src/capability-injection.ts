import type { Logger } from "@freeanima/kernel-logging";
import { getRuntimeLogger } from "./runtime-logger.ts";
import { readAppVersion } from "./version.ts";

export type CredentialMeta = {
  path: string;
  category?: string;
  fields?: string[];
  tags?: string[];
  desc?: string;
};

export type CapabilityInjection = {
  listCredentials?: () => CredentialMeta[];
  credential?: (path: string, field: string) => string;
  readAppVersion?: (repoRoot?: string) => string;
};

let injection: CapabilityInjection = {};

/** Composition root wires service-config helpers for capabilities */
export function registerCapabilityInjection(next: CapabilityInjection): void {
  injection = { ...injection, ...next };
}

export function resetCapabilityInjectionForTest(): void {
  injection = {};
}

export function listCredentialsForCapability(): CredentialMeta[] {
  if (!injection.listCredentials) {
    throw new Error(
      "listCredentials not registered; call registerCapabilityInjection at composition root",
    );
  }
  return injection.listCredentials();
}

export function credentialForCapability(path: string, field: string): string {
  if (!injection.credential) {
    throw new Error(
      "credential not registered; call registerCapabilityInjection at composition root",
    );
  }
  return injection.credential(path, field);
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
