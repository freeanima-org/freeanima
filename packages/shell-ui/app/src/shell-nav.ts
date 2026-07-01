/** 原生壳（Capacitor）使用 hash 路由（#/chat） */
export function isNativeShellNavigation(): boolean {
  return Boolean(window.satelliteShell?.isNativeShell);
}

export function navigateShellModule(
  navigate: (opts: { to: string }) => unknown,
  path: string,
): void {
  const target = path.startsWith("/") ? path : `/${path}`;
  if (isNativeShellNavigation()) {
    const nextHash = `#${target}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    return;
  }
  void navigate({ to: target });
}
