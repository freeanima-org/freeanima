import { useEffect } from "react";
import { listenSidecarError } from "@/lib/tauri.ts";
import { isTauri } from "@/lib/tauri.ts";
import { useCompanionStore } from "@/stores/companion.ts";

/** Tauri 生产包：监听 sidecar 致命错误并写入 store */
export function useSidecarError(fallbackMessage?: string): void {
  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    void listenSidecarError((msg) => {
      useCompanionStore.setState({
        error:
          fallbackMessage ??
          `后台服务启动失败：${msg}。请确认已安装 companion-bun 与 resources/sidecar，或改用完整安装包。`,
        loading: false,
      });
    }).then((fn) => {
      off = fn;
    });
    return () => off?.();
  }, [fallbackMessage]);
}
