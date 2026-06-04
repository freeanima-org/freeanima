import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileTreePanel } from "@/components/studio/FileTreePanel";
import { CodeViewerPanel } from "@/components/studio/CodeViewerPanel";
import { TerminalPanel } from "@/components/studio/TerminalPanel";
import { SessionPanel } from "@/components/studio/SessionPanel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePairProgrammingStore } from "@/stores/pair-programming";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/studio/pair-programming")({
  component: PairProgrammingPage,
});

function PairProgrammingPage() {
  const store = usePairProgrammingStore();
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(380);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(true);

  const configured = Boolean(store.config.workspace?.trim());

  useEffect(() => {
    if (isMobile) {
      setLeftVisible(false);
      setRightVisible(false);
      setTerminalVisible(false);
    }
  }, [isMobile]);

  useEffect(() => {
    void (async () => {
      await store.fetchConfig();
      const sessions = await store.fetchSessions();
      if (sessions.length && !usePairProgrammingStore.getState().currentSessionId) {
        await store.selectSession(sessions[0]!.id);
      }
      if (usePairProgrammingStore.getState().config.workspace?.trim()) {
        await store.fetchTree();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setWorkspaceInput(store.config.workspace || "");
  }, [store.config.workspace]);

  const saveWorkspace = async () => {
    const ws = workspaceInput.trim();
    if (!ws) return;
    await trpc.studio.config.patch.mutate({ workspace: ws });
    await store.fetchConfig();
    await store.fetchTree();
  };

  const startResize = (edge: "left" | "right" | "bottom", evt: React.MouseEvent) => {
    evt.preventDefault();
    const startX = evt.clientX;
    const startY = evt.clientY;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const startTerm = terminalHeight;

    const onMove = (e: MouseEvent) => {
      if (edge === "left") {
        setLeftWidth(Math.min(400, Math.max(160, startLeft + e.clientX - startX)));
      } else if (edge === "right") {
        setRightWidth(Math.min(700, Math.max(280, startRight - (e.clientX - startX))));
      } else {
        setTerminalHeight(Math.min(500, Math.max(100, startTerm - (e.clientY - startY))));
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!configured && !store.loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h3 className="text-lg font-bold">配置工作目录</h3>
          <p className="text-sm text-base-content/60">
            结对编程需要先设置{" "}
            <code className="text-xs bg-base-300 px-1 rounded">studio.workspace</code>。
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveWorkspace();
            }}
          >
            <input
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              type="text"
              className="input input-bordered flex-1 font-mono text-sm"
              placeholder="/path/to/project"
            />
            <button type="submit" className="btn btn-primary" disabled={!workspaceInput.trim()}>
              保存
            </button>
          </form>
          <Link to="/chamber/config" className="btn btn-ghost btn-sm">
            前往卧室配置
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden relative">
      <div className="shrink-0 flex items-center gap-0.5 px-2 py-1 border-b border-base-300 bg-base-200/40 text-xs">
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${leftVisible ? "" : "opacity-40"}`}
          onClick={() => setLeftVisible((v) => !v)}
          title="切换左侧面板"
        >
          📁
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${terminalVisible ? "" : "opacity-40"}`}
          onClick={() => setTerminalVisible((v) => !v)}
          title="切换终端面板"
        >
          ⬇
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${rightVisible ? "" : "opacity-40"}`}
          onClick={() => setRightVisible((v) => !v)}
          title="切换会话面板"
        >
          💬
        </button>
        <span className="flex-1" />
        <span className="text-base-content/30 text-xs select-none">面板</span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {leftVisible ? (
          <div
            className={[
              "shrink-0 flex flex-col min-h-0 border-r border-base-300 bg-base-200/20",
              isMobile ? "mobile-panel-overlay" : "",
            ].join(" ")}
            style={isMobile ? undefined : { width: leftWidth }}
          >
            <FileTreePanel />
          </div>
        ) : null}
        {leftVisible && !isMobile ? (
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
            onMouseDown={(e) => startResize("left", e)}
          />
        ) : null}

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <CodeViewerPanel file={store.currentFile} />
          </div>
          {terminalVisible ? (
            <div
              className="h-1 shrink-0 cursor-row-resize hover:bg-primary/30 active:bg-primary/50"
              onMouseDown={(e) => startResize("bottom", e)}
            />
          ) : null}
          {terminalVisible ? (
            <div className="shrink-0 min-h-0" style={{ height: terminalHeight }}>
              <TerminalPanel />
            </div>
          ) : null}
        </div>

        {rightVisible && !isMobile ? (
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
            onMouseDown={(e) => startResize("right", e)}
          />
        ) : null}

        {rightVisible ? (
          <div
            className={["shrink-0 min-h-0", isMobile ? "mobile-panel-overlay" : ""].join(" ")}
            style={isMobile ? undefined : { width: rightWidth }}
          >
            <SessionPanel />
          </div>
        ) : null}
      </div>

      {store.error ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 alert alert-warning shadow-lg text-sm max-w-lg z-10">
          {store.error}
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => store.clearError()}>
            关闭
          </button>
        </div>
      ) : null}
    </div>
  );
}
