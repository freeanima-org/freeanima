import type { AppRuntime } from "../runtime/app-runtime.ts";

export type WebuiServerHandle = {
  close: () => void | Promise<void>;
};

export type WebuiHooks = {
  start: (
    hosts: string[],
    port: number,
    opts?: { development?: boolean },
  ) => Promise<WebuiServerHandle[]>;
  close: (handles: WebuiServerHandle[], timeoutMs?: number) => Promise<void>;
  waitForDrain: (app: AppRuntime, maxMs: number) => Promise<void>;
};

export type ServeOptions = {
  /** CLI foreground blocking run (systemd/detached child also passes true; not the same as WebUI dev) */
  foreground?: boolean;
  /** CLI --dev：WebUI Bun fullstack HMR */
  webuiDev?: boolean;
  webui?: WebuiHooks;
};
