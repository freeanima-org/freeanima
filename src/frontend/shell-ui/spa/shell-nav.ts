/** 原生壳导航：委托 shell-sdk 壳子维 API */
export { shouldUseNativeShellNavigation as isNativeShellNavigation } from "@freeanima/frontend/shell-sdk/shell-runtime.ts";

export function navigateShellModule(
  navigate: (opts: { to: string }) => unknown,
  path: string,
): void {
  const target = path.startsWith("/") ? path : `/${path}`;
  void navigate({ to: target });
}
