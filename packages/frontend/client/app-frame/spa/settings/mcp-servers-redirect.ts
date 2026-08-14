/** 旧设置段 `?section=mcp_servers` → 栖息地 MCP 页 */
export function resolveMcpServersRedirectUrl(pathname: string): string {
  const settingsIdx = pathname.lastIndexOf("/settings");
  if (settingsIdx >= 0) {
    return `${pathname.slice(0, settingsIdx)}/habitat/mcp`;
  }
  return "/habitat/mcp";
}
