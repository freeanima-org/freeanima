import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ShellRouterProvider } from "./router.tsx";

document.documentElement.dataset.shellUi = "1";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
};

async function mountShellUi(): Promise<void> {
  const bridge = (window as ShellBridgeWindow).__freeanimaShellBridge;
  if (bridge) await bridge.ready;

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ShellRouterProvider />
    </StrictMode>,
  );
}

void mountShellUi();
