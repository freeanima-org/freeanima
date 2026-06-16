import { StrictMode, useCallback, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { VrmCanvas } from "@/renderer/VrmCanvas.tsx";
import { ChatBubble } from "@/components/ChatBubble.tsx";
import { ChatInput } from "@/components/ChatInput.tsx";
import { SettingsPanel } from "@/components/SettingsPanel.tsx";
import { useCompanionStore } from "@/stores/companion.ts";
import { useChatStore } from "@/stores/chat.ts";
import { usePetStore, startWalkStateMachine } from "@/stores/pet.ts";
import { subscribePetEvents } from "@/lib/api.ts";
import {
  isTauri,
  listenCursorPosition,
  listenSidecarError,
  setClickThrough,
  startWindowDrag,
} from "@/lib/tauri.ts";
import type { PetEvent } from "@/lib/types.ts";

function ClickThroughManager() {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const modelReady = useCompanionStore((s) => s.modelReady);
  const ignoringRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || !hitTestFn || !modelReady) return;

    let cleanupCursor: (() => void) | undefined;

    void listenCursorPosition((pos) => {
      const onCharacter = hitTestFn(pos.x, pos.y);
      const shouldIgnore = !onCharacter;
      if (shouldIgnore !== ignoringRef.current) {
        ignoringRef.current = shouldIgnore;
        void setClickThrough(shouldIgnore);
      }
    }).then((off) => {
      cleanupCursor = off;
    });

    return () => {
      cleanupCursor?.();
      void setClickThrough(false);
    };
  }, [hitTestFn, modelReady]);

  return null;
}

function App() {
  const {
    loading,
    error,
    modelPath,
    modelReady,
    settingsOpen,
    setSettingsOpen,
    init,
    clearError,
    setModelReady,
  } = useCompanionStore();
  const agentBubble = useChatStore((s) => s.agentBubble);
  const streaming = useChatStore((s) => s.streaming);
  const bubbleText = useChatStore((s) => s.bubbleText);
  const toolBubble = usePetStore((s) => s.toolBubble);
  const handlePetEvent = usePetStore((s) => s.handlePetEvent);

  const onModelReady = useCallback(() => {}, []);

  const onModelLoaded = useCallback(() => {
    setModelReady(true);
  }, [setModelReady]);

  const onModelError = useCallback(
    (msg: string) => {
      setModelReady(false);
      useCompanionStore.setState({ error: msg });
    },
    [setModelReady],
  );

  useEffect(() => {
    void init();
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    void listenSidecarError((msg) => {
      useCompanionStore.setState({
        error: `后台服务启动失败：${msg}。请确认 exe 与 sidecar 在同一目录，或改用安装包。`,
        loading: false,
      });
    }).then((fn) => {
      off = fn;
    });
    return () => off?.();
  }, [init]);

  useEffect(() => {
    if (streaming || agentBubble) {
      handlePetEvent({ type: "emote", emotion: "talk", weight: 0.5 });
    } else if (!toolBubble) {
      handlePetEvent({ type: "emote", emotion: "neutral", weight: 1 });
    }
  }, [streaming, agentBubble, toolBubble, handlePetEvent]);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    void subscribePetEvents((ev) => {
      handlePetEvent(ev as PetEvent);
    }).then((s) => {
      sub = s;
    });
    const stopWalk = startWalkStateMachine();
    return () => {
      sub?.unsubscribe();
      stopWalk();
    };
  }, [handlePetEvent]);

  const displayBubble = toolBubble || agentBubble || bubbleText;

  if (loading) {
    return (
      <div className="companion-overlay flex items-center justify-center">
        <div className="startup-panel text-center">
          <p className="font-medium mb-1">FreeAnima Companion</p>
          <p className="text-white/70 text-xs">正在连接本地后台…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="companion-overlay">
      <ClickThroughManager />
      <div className="absolute inset-0">
        <VrmCanvas
          modelPath={modelPath}
          onBackendReady={onModelReady}
          onModelError={onModelError}
          onModelLoaded={onModelLoaded}
        />
      </div>

      {!modelReady && !loading ? (
        <div className="absolute inset-x-6 top-1/3 z-10 chat-bubble text-center text-xs leading-relaxed">
          未加载 VRM 模型。点击右上角 ⚙ 上传或填写模型路径（可从 VRoid Hub 免费下载）。
        </div>
      ) : null}

      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
        onMouseDown={(e) => {
          if (e.button === 0) void startWindowDrag();
        }}
      >
        <ChatBubble text={displayBubble} />
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[min(90vw,320px)]">
        <ChatInput />
      </div>

      <div className="absolute top-3 right-3 z-20">
        <button
          type="button"
          className="text-xs text-white/50 hover:text-white bg-black/30 rounded-full px-2 py-1"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title="设置"
        >
          ⚙
        </button>
      </div>

      {settingsOpen ? (
        <div className="absolute top-12 right-3 z-20">
          <SettingsPanel />
        </div>
      ) : null}

      {error ? (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 chat-bubble text-red-300">
          {error}
          <button type="button" className="ml-2 text-xs underline" onClick={clearError}>
            关闭
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
