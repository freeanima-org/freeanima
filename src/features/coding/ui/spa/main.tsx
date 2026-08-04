import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauriMobileUserAgent, isTauriRuntime } from "@freeanima/client/portal-sdk/tauri-runtime";
import { Toaster } from "@freeanima/ui-kit/components/ui/sonner.tsx";

import { CodingApp } from "./CodingApp.tsx";
import { initAppLocale } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";

async function bootstrapCodingShell(): Promise<void> {
  if (!isTauriRuntime()) {
    console.warn(
      "[coding] 非 Tauri 运行时：portalShell 不会注入。若在 just dev tauri 的 Coding 窗内，请确认 capabilities remote.urls 含 Vite 源并重启壳。",
      { href: typeof location !== "undefined" ? location.href : "" },
    );
    return;
  }
  if (isTauriMobileUserAgent()) return;
  const { bootstrapTauriBridge } =
    await import("@freeanima/portal/app/tauri/bridge/bootstrap-tauri-desktop.ts");
  await bootstrapTauriBridge();
}

void bootstrapCodingShell()
  .catch((err) => {
    console.error("[coding] portalShell bootstrap failed", err);
  })
  .finally(() => {
    initAppLocale();
    const root = document.getElementById("root");
    if (!root) throw new Error("#root missing");
    createRoot(root).render(
      <StrictMode>
        <CodingApp />
        <Toaster />
      </StrictMode>,
    );
  });
