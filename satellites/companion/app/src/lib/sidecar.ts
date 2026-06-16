import { getSidecarPort, isTauri } from "./tauri.ts";

const DEFAULT_PORT = 4176;

/** Tauri 生产包：API 必须走 sidecar HTTP，不能走内嵌 asset 路径 */
export async function resolveSidecarOrigin(maxWaitMs = 30_000): Promise<string> {
  if (!isTauri()) {
    return window.location.origin;
  }

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const port = (await getSidecarPort()) ?? DEFAULT_PORT;
    const origin = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${origin}/health`, { cache: "no-store" });
      if (res.ok) return origin;
    } catch {
      /* sidecar 尚未就绪 */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("桌宠后台服务启动超时，请检查是否被杀毒软件拦截");
}
