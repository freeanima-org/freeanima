import { credential, listCredentials, readAppVersion } from "@freeanima/service-config";
import { registerCapabilityInjection } from "@freeanima/storage-config";

/** Wire service-config I/O helpers for capabilities packages */
export function wireCapabilityInjection(): void {
  registerCapabilityInjection({
    listCredentials,
    credential,
    readAppVersion,
  });
}
