import { registerCapabilityInjection } from "@freeanima/habitat/core/config/capability-injection";
import { readAppVersion, resolveVaultField } from "@freeanima/habitat/platform/config";

/** Bind service-config I/O helpers for capabilities packages */
export function bindCapabilityInjection(): void {
  registerCapabilityInjection({
    vault: async (itemId: number, field: string) => resolveVaultField(itemId, field),
    readAppVersion,
  });
}
