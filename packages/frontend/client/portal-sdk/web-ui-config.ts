import { isRecord } from "@freeanima/shared/util";

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
  if (!isRecord(raw)) return null;
  const appId = typeof raw.app_id === "string" ? raw.app_id : "chat";
  const habitatUrl = typeof raw.habitat_url === "string" ? raw.habitat_url : "";
  const habitatWsUrl = typeof raw.habitat_ws_url === "string" ? raw.habitat_ws_url : "";
  const layoutRaw = raw.layout_mode;
  const layout_mode = layoutRaw === "compact" || layoutRaw === "expanded" ? layoutRaw : undefined;
  const webBuild = parseComponentBuildMeta(raw.web_build);
  const remoteAuth =
    typeof raw.remote_auth_token === "string" ? raw.remote_auth_token.trim() : undefined;
  return {
    app_id: appId,
    habitat_url: habitatUrl,
    habitat_ws_url: habitatWsUrl,
    ...(typeof raw.ui_version === "string" ? { ui_version: raw.ui_version } : {}),
    ...(webBuild ? { web_build: webBuild } : {}),
    ...(typeof raw.min_shell_version === "string"
      ? { min_shell_version: raw.min_shell_version }
      : {}),
    ...(layout_mode ? { layout_mode } : {}),
    ...(remoteAuth ? { remote_auth_token: remoteAuth } : {}),
  };
}
