import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauriMobileUserAgent, isTauriRuntime } from "@freeanima/client/portal-sdk/tauri-runtime";
import { SubjectScopeProvider } from "@freeanima/client/portal-sdk/react.tsx";

import { PomodoroFloatApp } from "./PomodoroFloatApp.tsx";

async function bootstrapFloatShell(): Promise<void> {
  if (!isTauriRuntime()) {
    console.warn(
      "[pomodoro-float] 非 Tauri 运行时：portalShell 不会注入。请确认 capabilities remote.urls 含 :4196。",
    );
    return;
  }
  if (isTauriMobileUserAgent()) return;
  const { bootstrapTauriBridge } =
    await import("@freeanima/portal/app/tauri/bridge/bootstrap-tauri-desktop.ts");
  await bootstrapTauriBridge();
}

void bootstrapFloatShell()
  .catch((err) => {
    console.error("[pomodoro-float] portalShell bootstrap failed", err);
  })
  .finally(() => {
    const root = document.getElementById("root");
    if (!root) throw new Error("#root missing");
    createRoot(root).render(
      <StrictMode>
        <SubjectScopeProvider>
          <PomodoroFloatApp />
        </SubjectScopeProvider>
      </StrictMode>,
    );
  });
