import { showAlert, showConfirm } from "./confirm-prompt.tsx";

let installed = false;

function logBlocked(method: string, detail?: unknown): void {
  console.error(
    `[FreeAnima] window.${method}() 已在 UI 中禁用，请使用 @freeanima/ui-kit/composite 的 showConfirm / showAlert。`,
    detail,
  );
}

/** 拦截浏览器原生 alert/confirm/prompt，统一走 shadcn 对话框 */
export function blockNativeDialogs(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.alert = (message?: string) => {
    logBlocked("alert", message);
    void showAlert({ description: message ?? "" });
  };

  window.confirm = (message?: string) => {
    logBlocked("confirm", message);
    void showConfirm({ description: message ?? "" });
    return false;
  };

  window.prompt = () => {
    logBlocked("prompt");
    return null;
  };
}
