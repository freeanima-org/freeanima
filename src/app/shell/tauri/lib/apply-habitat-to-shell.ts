import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import { buildShellApiFields, type ShellApi } from "@freeanima/frontend/shell-sdk";

const DEFAULT_HABITAT_URL = "http://127.0.0.1:2658";

/** 把已保存的栖息地配置同步到内存中的 satelliteShell（供 needsHabitatSetup / API 鉴权）。 */
export function applyHabitatConfigToShell(
  shell: ShellApi,
  habitatUrl: string,
  remoteAuthToken: string,
): void {
  const url =
    String(habitatUrl ?? "")
      .trim()
      .replace(/\/$/, "") || DEFAULT_HABITAT_URL;
  const fields = buildShellApiFields(
    url,
    resolveHabitatRpcWsUrl(url),
    String(remoteAuthToken ?? "").trim(),
  );
  shell.habitatUrl = fields.habitatUrl;
  shell.habitatWsUrl = fields.habitatWsUrl;
  if (fields.remoteAuth !== undefined) {
    shell.remoteAuth = fields.remoteAuth;
  } else {
    delete shell.remoteAuth;
  }
  if (fields.habitatFetch !== undefined) {
    shell.habitatFetch = fields.habitatFetch;
  } else {
    delete shell.habitatFetch;
  }
}

export const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

/** 通知前端 RPC / 离线同步：Habitat URL / token 已变更。 */
export function notifyShellConfigChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}
