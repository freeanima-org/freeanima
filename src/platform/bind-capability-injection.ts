import { registerCapabilityInjection } from "@freeanima/core/config";
import { readAppVersion, resolveVaultField } from "@freeanima/platform/config";

/** Bind service-config I/O helpers for capabilities packages */
export function bindCapabilityInjection(): void {
  registerCapabilityInjection({
    vault: async (itemId: number, field: string) => resolveVaultField(itemId, field),
    readAppVersion,
  });
}
