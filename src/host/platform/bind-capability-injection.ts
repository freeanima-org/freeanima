import { registerCapabilityInjection } from "@freeanima/host/core/config";
import { readAppVersion, resolveVaultField } from "@freeanima/host/platform/config";

/** Bind service-config I/O helpers for capabilities packages */
export function bindCapabilityInjection(): void {
  registerCapabilityInjection({
    vault: async (itemId: number, field: string) => resolveVaultField(itemId, field),
    readAppVersion,
  });
}
