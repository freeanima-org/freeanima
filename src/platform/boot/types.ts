import type { AppRuntime } from "../runtime/app-runtime.ts";
import type { ResolvedHubTlsListenConfig } from "../tls/resolve-hub-tls.ts";

export type HttpServerHandle = {
  close: () => void | Promise<void>;
};

export type HttpListenOptions = {
  tls?: ResolvedHubTlsListenConfig | null;
};

export type HttpStartResult = {
  handles: HttpServerHandle[];
  tlsPort: number | null;
};

export type HttpHooks = {
  start: (hosts: string[], port: number, opts?: HttpListenOptions) => Promise<HttpStartResult>;
  close: (handles: HttpServerHandle[], timeoutMs?: number) => Promise<void>;
  waitForDrain: (app: AppRuntime, maxMs: number) => Promise<void>;
};

export type ServeOptions = {
  /** CLI foreground blocking run (systemd/detached child also passes true) */
  foreground?: boolean;
  http?: HttpHooks;
  /** TLS 监听配置（传给 http.start 第三参） */
  httpListen?: HttpListenOptions;
  /** Called after HTTP listen and status phase=ready (before async integrations). */
  onReady?: () => void | Promise<void>;
};
