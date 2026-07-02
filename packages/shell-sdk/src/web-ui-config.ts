/** Hub `/web/config.json` 契约（运行时生成） */
export type WebUiConfigJson = {
  app_id: string;
  hub_url: string;
  hub_ws_url: string;
  ui_version?: string;
  min_shell_version?: string;
  layout_mode?: "compact" | "expanded";
  /** 仅 loopback 直连时由 Hub 注入；勿写入持久化 meta */
  auth_token?: string;
};

export function parseWebUiConfigJson(raw: unknown): WebUiConfigJson | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const appId = typeof o.app_id === "string" ? o.app_id : "chat";
  const hubUrl = typeof o.hub_url === "string" ? o.hub_url : "";
  const hubWsUrl = typeof o.hub_ws_url === "string" ? o.hub_ws_url : "";
  const layoutRaw = o.layout_mode;
  const layout_mode = layoutRaw === "compact" || layoutRaw === "expanded" ? layoutRaw : undefined;
  return {
    app_id: appId,
    hub_url: hubUrl,
    hub_ws_url: hubWsUrl,
    ...(typeof o.ui_version === "string" ? { ui_version: o.ui_version } : {}),
    ...(typeof o.min_shell_version === "string" ? { min_shell_version: o.min_shell_version } : {}),
    ...(layout_mode ? { layout_mode } : {}),
    ...(typeof o.auth_token === "string" && o.auth_token.trim()
      ? { auth_token: o.auth_token.trim() }
      : {}),
  };
}
