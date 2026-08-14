/** 原生壳导航：委托 portal-sdk 壳子维 API */
export { shouldUseNativeShellNavigation as isNativeShellNavigation } from "@freeanima/client/portal-sdk/shell-runtime.ts";

export function navigateAppModule(navigate: (opts: { to: string }) => unknown, path: string): void {
  const target = path.startsWith("/") ? path : `/${path}`;
  void navigate({ to: target });
}
