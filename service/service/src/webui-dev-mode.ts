/** Whether WebUI enables Bun fullstack HMR (independent of CLI --foreground) */
export function resolveWebuiDevMode(webuiDev?: boolean): boolean {
  const env = process.env.ANIMA_WEBUI_DEV?.trim();
  if (env === "1") return true;
  if (env === "0") return false;
  return Boolean(webuiDev);
}
