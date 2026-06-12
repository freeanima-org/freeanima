import {
  registerCapabilityInjection,
  resetCapabilityInjectionForTest,
} from "../capability-injection.ts";
import type { CapabilityInjection } from "../capability-injection.ts";

/** Wire credential helpers for unit tests (pass implementations from `@freeanima/service-config`). */
export function wireCapabilityInjectionForTest(next: CapabilityInjection): void {
  registerCapabilityInjection(next);
}

export { resetCapabilityInjectionForTest };
