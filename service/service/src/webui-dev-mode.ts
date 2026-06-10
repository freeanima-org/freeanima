/** WebUI 是否启用 Bun fullstack HMR（与 CLI --foreground 无关） */
export function resolveWebuiDevMode(webuiDev?: boolean): boolean {
  const env = process.env.ANIMA_WEBUI_DEV?.trim();
  if (env === "1") return true;
  if (env === "0") return false;
  return Boolean(webuiDev);
}
