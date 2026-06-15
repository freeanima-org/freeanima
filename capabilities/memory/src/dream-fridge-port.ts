import type { DreamFridgePort } from "./dream/run.ts";

let dreamFridgePort: DreamFridgePort | null = null;

/** Injected by service at startup */
export function registerDreamFridge(port: DreamFridgePort): void {
  dreamFridgePort = port;
}

export function getDreamFridge(): DreamFridgePort | null {
  return dreamFridgePort;
}

/** Reset for tests */
export function resetDreamFridgeForTests(): void {
  dreamFridgePort = null;
}
