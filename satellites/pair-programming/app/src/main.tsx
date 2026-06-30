import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileTreePanel } from "@pair/components/FileTreePanel.tsx";
import { CodeViewerPanel } from "@pair/components/CodeViewerPanel.tsx";
import { TerminalPanel } from "@pair/components/TerminalPanel.tsx";
import { ConversationPanel } from "@pair/components/ConversationPanel.tsx";
import { useMediaQuery } from "@pair/hooks/useMediaQuery.ts";
import { usePairProgrammingStore } from "@pair/stores/pair-programming.ts";
import { getAppLocale, initAppLocale, m, setLocale } from "@pair/lib/i18n.ts";

initAppLocale();

function App() {
  const store = usePairProgrammingStore();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [locale, setLocaleState] = useState(getAppLocale());

  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(380);
  const [terminalHeight, setTerminalHeight] = useState(200);
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
      const conversations = await store.fetchConversations();
      if (conversations.length && !usePairProgrammingStore.getState().currentConversationId) {
        await store.selectConversation(conversations[0]!.id);
      }
      if (usePairProgrammingStore.getState().config.workspace?.trim()) {
        await store.fetchTree();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const toggleLocale = () => {
    const next = locale === "zh-cn" ? "en" : "zh-cn";
    setLocale(next);
    setLocaleState(next);
  };

  if (!configured && !store.loading) {
    return (
      <div className="h-screen flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200">
          <span className="text-sm font-medium">{m.pair_nav_pair()}</span>
          <button type="button" className="btn btn-xs btn-ghost" onClick={toggleLocale}>
            {locale === "zh-cn" ? "EN" : "中文"}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <h3 className="text-lg font-bold">{m.pair_workdir_title()}</h3>
            <p className="text-sm text-base-content/60">{m.pair_workdir_lead()}</p>
            <p className="text-sm font-mono text-left bg-base-300/40 p-3 rounded">
              satellites:
              <br />
              {"  pair-programming:"}
              <br />
              {"    command: bun"}
              <br />
              {'    args: ["satellites/pair-programming/dev.ts"]'}
              <br />
              {"    env:"}
              <br />
              {"      STUDIO_WORKSPACE: /path/to/project"}
            </p>
            <p className="text-xs text-base-content/50">anima service restart</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col min-h-0 overflow-hidden relative">
      <header className="shrink-0 flex items-center gap-2 px-2 py-1 border-b border-base-300 bg-base-200/80 text-sm">
        <span className="font-medium">{m.pair_nav_pair()}</span>
        <span className="flex-1" />
        <button type="button" className="btn btn-xs btn-ghost" onClick={toggleLocale}>
          {locale === "zh-cn" ? "EN" : "中文"}
        </button>
      </header>

      <div className="shrink-0 flex items-center gap-0.5 px-2 py-1 border-b border-base-300 bg-base-200/40 text-xs">
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${leftVisible ? "" : "opacity-40"}`}
          onClick={() => setLeftVisible((v) => !v)}
          title={m.pair_toggle_left_panel()}
        >
          📁
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${terminalVisible ? "" : "opacity-40"}`}
          onClick={() => setTerminalVisible((v) => !v)}
          title={m.pair_toggle_terminal_panel()}
        >
          ⬇
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${rightVisible ? "" : "opacity-40"}`}
          onClick={() => setRightVisible((v) => !v)}
          title={m.pair_toggle_conversation_panel()}
        >
          💬
        </button>
        <span className="flex-1" />
        <span className="text-base-content/30 text-xs select-none">{m.pair_panels()}</span>
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
            <ConversationPanel />
          </div>
        ) : null}
      </div>

      {store.error ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 alert alert-warning shadow-lg text-sm max-w-lg z-10">
          {store.error}
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => store.clearError()}>
            {m.admin_common_close()}
          </button>
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
