import {
  registerCapabilityInjection,
  resetCapabilityInjectionForTest,
} from "../capability-injection.ts";
import type { CapabilityInjection } from "../capability-injection.ts";

/** Bind vault helpers for unit tests (implementations from `@freeanima/host/platform/config`). */
export function bindCapabilityInjectionForTest(next: CapabilityInjection): void {
  registerCapabilityInjection(next);
}

export { resetCapabilityInjectionForTest };
