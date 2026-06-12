import { credential, listCredentials, readAppVersion } from "@freeanima/platform/config";
import { registerCapabilityInjection } from "@freeanima/core/config";

/** Wire service-config I/O helpers for capabilities packages */
export function wireCapabilityInjection(): void {
  registerCapabilityInjection({
    listCredentials,
    credential,
    readAppVersion,
  });
}
