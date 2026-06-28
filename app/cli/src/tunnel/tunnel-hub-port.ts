import { readStatusFile } from "@freeanima/platform/alive";

/** 与 `anima service --port` 默认值一致 */
export const DEFAULT_HUB_PORT = 2658;

/** 解析 Hub 监听端口：CLI 覆盖 > server.status.json > 默认 2658 */
export function resolveHubPort(override?: number): number {
  if (override != null && Number.isFinite(override) && override > 0) {
    return Math.trunc(override);
  }
  const status = readStatusFile();
  if (status?.port != null) {
    const fromStatus = Number(status.port);
    if (Number.isFinite(fromStatus) && fromStatus > 0) {
      return fromStatus;
    }
  }
  return DEFAULT_HUB_PORT;
}
