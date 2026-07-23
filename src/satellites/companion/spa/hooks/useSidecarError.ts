import { useEffect } from "react";
import {
  isPortalShell,
  listenServerError,
} from "@freeanima/satellites/companion/spa/lib/portal-shell.ts";
import { useCompanionStore } from "@freeanima/satellites/companion/spa/stores/companion.ts";

/** Portal：监听壳层服务致命错误并写入 store */
export function useSidecarError(fallbackMessage?: string): void {
  useEffect(() => {
    if (!isPortalShell()) return;
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
