import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { bootstrapSentryFromSettings, Sentry } from "./bootstrap/sentry.ts";
import { ShellRouterProvider } from "./router.tsx";

document.documentElement.dataset.shellUi = "1";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
};

function ShellErrorFallback({
  error,
  resetError,
}: {
  error: unknown;
  resetError: () => void;
}): JSX.Element {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";
  const detail = stack ? `${message}\n\n${stack}` : message;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-base-200">
      <div className="max-w-lg w-full space-y-4 rounded-lg border border-base-300 bg-base-100 p-4">
        <h1 className="text-lg font-semibold">界面出错</h1>
        <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto opacity-80">
          {message}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm btn-primary" onClick={resetError}>
            重试
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => void navigator.clipboard.writeText(detail)}
          >
            复制详情
          </button>
        </div>
      </div>
    </div>
  );
}

async function mountShellUi(): Promise<void> {
  const bridge = (window as ShellBridgeWindow).__freeanimaShellBridge;
  if (bridge) await bridge.ready;

  await bootstrapSentryFromSettings();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={ShellErrorFallback} showDialog={false}>
        <ShellRouterProvider />
      </Sentry.ErrorBoundary>
    </StrictMode>,
  );
}

void mountShellUi();
