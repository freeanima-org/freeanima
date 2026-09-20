import type { FeatureRpcHandler, FeatureRegistryPort } from "./types.ts";

/**
 * 当前 feature registry（组合根 `mountFeatureService` 登记）。
 *
 * 能力层 dispatch 与深层的 handler 查找没有 ctx；这里直接持有端口，
 * 不再查进程根 context。
 */
let registry: FeatureRegistryPort | null = null;

/** 由组合根在挂载 FeatureService 时登记；传 null 清除。 */
export function setFeatureRegistryPort(port: FeatureRegistryPort | null): void {
  registry = port;
}

export function resetFeatureRegistryPortForTest(): void {
  registry = null;
}

/** 当前 registry 上的 handler 查找（未挂载时 undefined）。 */
export function getFeatureRpcHandler(method: string): FeatureRpcHandler | undefined {
  return registry?.getHandler(method);
}
