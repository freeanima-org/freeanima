import {
  registerCapabilityInjection,
  resetCapabilityInjectionForTest,
} from "../capability-injection.ts";
import type { CapabilityInjection } from "../capability-injection.ts";

/** Wire vault helpers for unit tests (implementations from `@freeanima/platform/config`). */
export function wireCapabilityInjectionForTest(next: CapabilityInjection): void {
  registerCapabilityInjection(next);
}

export { resetCapabilityInjectionForTest };
