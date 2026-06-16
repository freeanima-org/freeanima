/** Tauri 壳层桥接；浏览器 dev 模式下为 no-op */

type TauriWindow = {
  __TAURI__?: {
    core: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    event: {
      listen: <T>(event: string, handler: (ev: { payload: T }) => void) => Promise<() => void>;
    };
  };
};

function tauri(): TauriWindow["__TAURI__"] | null {
  return (window as TauriWindow).__TAURI__ ?? null;
}

export function isTauri(): boolean {
  return tauri() !== null;
}

export async function setClickThrough(ignore: boolean): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("set_clickthrough", { ignore });
}

export async function moveWindow(x: number, y: number): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("move_window", { x, y });
}

export async function listenCursorPosition(
  handler: (pos: { x: number; y: number }) => void,
): Promise<() => void> {
  const api = tauri();
  if (!api) return () => {};
  return api.event.listen<{ x: number; y: number }>("cursor-position", (ev) => {
    handler(ev.payload);
  });
}

export async function startWindowDrag(): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("start_drag");
}

export async function getSidecarPort(): Promise<number | null> {
  const api = tauri();
  if (!api) return null;
  return api.core.invoke<number>("get_sidecar_port");
}
