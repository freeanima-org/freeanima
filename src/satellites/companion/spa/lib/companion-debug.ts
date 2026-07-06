import { SATELLITE_PORT_START } from "@shared/constants.ts";

/** 开发模式或 localStorage `companion:debug=1` 时输出交互/巡逻诊断日志 */
export function companionDebug(...args: unknown[]): void {
  if (!isCompanionDebugEnabled()) return;
  console.log("[companion:debug]", ...args);
}

function isLocalCompanionDevServer(): boolean {
  if (typeof location === "undefined") return false;
  const host = location.hostname;
  const port = Number(location.port);
  return (
    (host === "127.0.0.1" || host === "localhost") &&
    port >= SATELLITE_PORT_START &&
    port <= SATELLITE_PORT_START + 10
  );
}

export function isCompanionDebugEnabled(): boolean {
  try {
    if (localStorage.getItem("companion:debug") === "0") return false;
    if (localStorage.getItem("companion:debug") === "1") return true;
  } catch {
    /* SSR / 隐私模式 */
  }

  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (env?.DEV === true) return true;

  return isLocalCompanionDevServer();
}
