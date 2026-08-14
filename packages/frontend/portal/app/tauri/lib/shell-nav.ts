import { shouldUseNativeShellNavigation } from "@freeanima/client/portal-sdk/shell-runtime.ts";

/** 移动壳使用 hash 路由（#/chat），避免 WebView 对 /chat 等路径返回 404 */
export { shouldUseNativeShellNavigation as isNativeShellNavigation } from "@freeanima/client/portal-sdk/shell-runtime.ts";

export function readShellPath(): string {
  if (shouldUseNativeShellNavigation() || window.location.hash.startsWith("#/")) {
    const hash = window.location.hash.replace(/^#/, "");
    return hash.startsWith("/") ? hash : `/${hash}`;
  }
  return window.location.pathname;
}

export function replaceShellPath(path: string): void {
  const target = path.startsWith("/") ? path : `/${path}`;
  if (shouldUseNativeShellNavigation()) {
    const nextHash = `#${target}`;
    if (window.location.hash === nextHash) return;
    window.location.hash = nextHash;
    return;
  }
  if (window.location.pathname === target) return;
  window.history.replaceState(null, "", target);
}
