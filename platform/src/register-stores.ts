import { registerDreamFridge } from "@freeanima/capabilities-memory/dream-fridge-port";
import { registerEmailSyncPort } from "@freeanima/capabilities-email";
import { emailSyncPortImpl } from "@freeanima/platform/connectors/email";

import { createDreamFridgePort } from "./dream-fridge-factory.ts";

/** Composition root one-shot capability wiring (dream fridge / email sync) */
export function registerServiceStores(): void {
  registerDreamFridge(createDreamFridgePort());
  registerEmailSyncPort(emailSyncPortImpl);
}
