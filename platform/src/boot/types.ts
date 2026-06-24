import type { AppRuntime } from "../runtime/app-runtime.ts";

export type HttpServerHandle = {
  close: () => void | Promise<void>;
};

/** @deprecated 使用 HttpServerHandle */
export type WebuiServerHandle = HttpServerHandle;

export type HttpHooks = {
  start: (
    hosts: string[],
    port: number,
    opts?: Record<string, never>,
  ) => Promise<HttpServerHandle[]>;
  close: (handles: HttpServerHandle[], timeoutMs?: number) => Promise<void>;
  waitForDrain: (app: AppRuntime, maxMs: number) => Promise<void>;
};

/** @deprecated 使用 HttpHooks */
export type WebuiHooks = HttpHooks;

export type ServeOptions = {
  /** CLI foreground blocking run (systemd/detached child also passes true) */
  foreground?: boolean;
  http?: HttpHooks;
  /** @deprecated 使用 http */
  webui?: HttpHooks;
  /** Called after HTTP listen and status phase=ready (before async integrations). */
  onReady?: () => void | Promise<void>;
};
