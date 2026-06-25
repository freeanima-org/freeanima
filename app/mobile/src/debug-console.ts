let vConsoleInstance: { destroy: () => void } | null = null;

export async function enableMobileDebugConsole(): Promise<void> {
  if (vConsoleInstance) return;
  const { default: VConsole } = await import("vconsole");
  vConsoleInstance = new VConsole();
}

export function disableMobileDebugConsole(): void {
  vConsoleInstance?.destroy();
  vConsoleInstance = null;
}

export function isMobileDebugConsoleEnabled(): boolean {
  return vConsoleInstance != null;
}

export async function applyMobileDebugConsole(enabled: boolean): Promise<void> {
  if (enabled) await enableMobileDebugConsole();
  else disableMobileDebugConsole();
}
