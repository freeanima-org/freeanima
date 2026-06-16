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
import { isTauri, listenCursorPosition, setClickThrough, startWindowDrag } from "@/lib/tauri.ts";
import type { PetEvent } from "@/lib/types.ts";

function ClickThroughManager() {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const ignoringRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || !hitTestFn) return;

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
  }, [hitTestFn]);

  return null;
}

function App() {
  const { loading, error, modelPath, settingsOpen, setSettingsOpen, init, clearError } =
    useCompanionStore();
  const agentBubble = useChatStore((s) => s.agentBubble);
  const streaming = useChatStore((s) => s.streaming);
  const bubbleText = useChatStore((s) => s.bubbleText);
  const toolBubble = usePetStore((s) => s.toolBubble);
  const handlePetEvent = usePetStore((s) => s.handlePetEvent);

  const onModelReady = useCallback(() => {}, []);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (streaming || agentBubble) {
      handlePetEvent({ type: "emote", emotion: "talk", weight: 0.5 });
    } else if (!toolBubble) {
      handlePetEvent({ type: "emote", emotion: "neutral", weight: 1 });
    }
  }, [streaming, agentBubble, toolBubble, handlePetEvent]);

  useEffect(() => {
    const sub = subscribePetEvents((ev) => {
      handlePetEvent(ev as PetEvent);
    });
    const stopWalk = startWalkStateMachine();
    return () => {
      sub.unsubscribe();
      stopWalk();
    };
  }, [handlePetEvent]);

  const displayBubble = toolBubble || agentBubble || bubbleText;

  if (loading) {
    return (
      <div className="companion-overlay flex items-center justify-center text-white/60 text-sm">
        加载中…
      </div>
    );
  }

  return (
    <div className="companion-overlay">
      <ClickThroughManager />
      <div className="absolute inset-0">
        <VrmCanvas modelPath={modelPath} onBackendReady={onModelReady} />
      </div>

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
