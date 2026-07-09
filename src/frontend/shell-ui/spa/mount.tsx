import { StrictMode, type ComponentType, type JSX, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import type { SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";
import { blockNativeDialogs, ConfirmPromptHost } from "@freeanima/frontend/ui-kit/composite";

import { bootstrapSentryFromSettings, Sentry } from "./bootstrap/sentry.ts";
import { ShellRouterProvider } from "./router.tsx";
import { setShellAppBindings, ShellAppProvider } from "./shell-app-context.tsx";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
  __freeanimaShellBootError?: string;
};

const SHELL_BRIDGE_WAIT_MS = 15_000;

function withPromiseTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms);
    }),
  ]);
}

function readShellBootError(): string | null {
  const message = (window as ShellBridgeWindow).__freeanimaShellBootError?.trim();
  return message || null;
}

function ShellBootNotice({ message }: { message: string }): JSX.Element {
  return (
    <div
      role="alert"
      className="shrink-0 border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-300"
    >
      启动异常：{message}。可在「设置」中检查 Hub 配置，或完全关闭应用后重试。
    </div>
  );
}

function ShellMountError({ message, detail }: { message: string; detail: string }): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted">
      <Card className="max-w-lg w-full">
        <CardContent className="space-y-4 pt-6">
          <h1 className="text-lg font-semibold">界面无法启动</h1>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto opacity-80">
            {message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => location.reload()}>
              重新加载
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(detail)}
            >
              复制详情
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted">
      <Card className="max-w-lg w-full">
        <CardContent className="space-y-4 pt-6">
          <h1 className="text-lg font-semibold">界面出错</h1>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto opacity-80">
            {message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={resetError}>
              重试
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(detail)}
            >
              复制详情
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type MountShellUiOptions = { bindings: SettingsBinding[]; headerSlot?: ReactNode };

function ShellAppTree({
  bindings,
  bootError,
  headerSlot,
}: {
  bindings: SettingsBinding[];
  bootError: string | null;
  headerSlot?: ReactNode;
}): JSX.Element {
  const content: ReactNode = (
    <>
      {bootError ? <ShellBootNotice message={bootError} /> : null}
      {headerSlot}
      <ShellRouterProvider />
    </>
  );

  return (
    <ShellAppProvider bindings={bindings}>
      <ConfirmPromptHost />
      <div className="h-full min-h-screen flex flex-col">{content}</div>
    </ShellAppProvider>
  );
}

const ShellErrorBoundary = Sentry.ErrorBoundary as unknown as ComponentType<{
  fallback: typeof ShellErrorFallback;
  showDialog: boolean;
  children?: ReactNode;
}>;

export async function mountShellUi(opts: MountShellUiOptions): Promise<void> {
  setShellAppBindings(opts.bindings);

  const bridge = (window as ShellBridgeWindow).__freeanimaShellBridge;
  let bootError = readShellBootError();

  if (bridge) {
    try {
      await withPromiseTimeout(bridge.ready, SHELL_BRIDGE_WAIT_MS, "移动壳启动");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[mountShellUi] shell bridge:", err);
      bootError = bootError ?? message;
    }
  }

  void bootstrapSentryFromSettings(opts.bindings);

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("缺少 #root 容器");
  }

  blockNativeDialogs();

  createRoot(rootEl).render(
    <StrictMode>
      <ShellErrorBoundary fallback={ShellErrorFallback} showDialog={false}>
        <ShellAppTree bindings={opts.bindings} bootError={bootError} headerSlot={opts.headerSlot} />
      </ShellErrorBoundary>
    </StrictMode>,
  );
}

export function renderShellMountFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";
  const detail = stack ? `${message}\n\n${stack}` : message;
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  createRoot(rootEl).render(<ShellMountError message={message} detail={detail} />);
}
