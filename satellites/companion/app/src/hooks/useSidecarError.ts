import { useEffect } from "react";
import { isElectron, listenServerError } from "@/lib/electron.ts";
import { useCompanionStore } from "@/stores/companion.ts";

/** Electron 生产包：监听主进程服务致命错误并写入 store */
export function useSidecarError(fallbackMessage?: string): void {
  useEffect(() => {
    if (!isElectron()) return;
    let off: (() => void) | undefined;
    void listenServerError((msg) => {
      useCompanionStore.setState({
        error:
          fallbackMessage ??
          `后台服务启动失败：${msg}。请查看 ~/.anima/companion/shell.log，并确认本地端口未被占用。`,
        loading: false,
      });
    }).then((fn) => {
      off = fn;
    });
    return () => off?.();
  }, [fallbackMessage]);
}
