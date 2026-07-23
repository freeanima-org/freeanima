import type { ComponentBuildMeta } from "./build-meta.ts";
import { parseComponentBuildMeta } from "./build-meta.ts";

/** Habitat `/web/config.json` 契约（运行时生成） */
export type WebUiConfigJson = {
  app_id: string;
  habitat_url: string;
  habitat_ws_url: string;
  ui_version?: string;
  web_build?: ComponentBuildMeta;
  min_shell_version?: string;
  layout_mode?: "compact" | "expanded";
  /** 仅 Vite `dev:web` 注入；生产 Habitat 托管永不下发 */
  remote_auth_token?: string;
};

export function parseWebUiConfigJson(raw: unknown): WebUiConfigJson | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const appId = typeof o.app_id === "string" ? o.app_id : "chat";
  const habitatUrl = typeof o.habitat_url === "string" ? o.habitat_url : "";
  const habitatWsUrl = typeof o.habitat_ws_url === "string" ? o.habitat_ws_url : "";
  const layoutRaw = o.layout_mode;
  const layout_mode = layoutRaw === "compact" || layoutRaw === "expanded" ? layoutRaw : undefined;
  const webBuild = parseComponentBuildMeta(o.web_build);
  const remoteAuth =
    typeof o.remote_auth_token === "string" ? o.remote_auth_token.trim() : undefined;
  return {
    app_id: appId,
    habitat_url: habitatUrl,
    habitat_ws_url: habitatWsUrl,
    ...(typeof o.ui_version === "string" ? { ui_version: o.ui_version } : {}),
    ...(webBuild ? { web_build: webBuild } : {}),
    ...(typeof o.min_shell_version === "string" ? { min_shell_version: o.min_shell_version } : {}),
    ...(layout_mode ? { layout_mode } : {}),
    ...(remoteAuth ? { remote_auth_token: remoteAuth } : {}),
  };
}
