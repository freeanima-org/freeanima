import { StrictMode, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { CharacterViewport } from "@/components/CharacterViewport.tsx";
import { SettingsPanel } from "@/components/SettingsPanel.tsx";
import { TextBubbleOverlay } from "@/components/TextBubbleOverlay.tsx";
import { useCompanionStore } from "@/stores/companion.ts";
import { onCharacterModelReady, startPatrolWatcher } from "@/stores/character.ts";
import { useSidecarError } from "@/hooks/useSidecarError.ts";
import {
  isCompanionOverlay,
  isSettingsView,
  listenConfigChanged,
  listenCursorPosition,
  openSettings,
  setClickThrough,
  setPointerActive,
} from "@/lib/electron.ts";
import { companionDebug } from "@/lib/companion-debug.ts";
import { useRef } from "react";

function ClickThroughManager() {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const characterReady = useCompanionStore((s) => s.characterReady);
  const pointerActive = useCompanionStore((s) => s.pointerActive);
  const ignoringRef = useRef(false);

  useEffect(() => {
    if (!isCompanionOverlay() || !hitTestFn || !characterReady) return;

    let cleanupCursor: (() => void) | undefined;

    void listenCursorPosition((pos) => {
      const onCharacter = hitTestFn(pos.x, pos.y);
      const shouldIgnore = pointerActive ? false : !onCharacter;
      if (shouldIgnore !== ignoringRef.current) {
        ignoringRef.current = shouldIgnore;
        companionDebug("点击穿透", {
          ignore: shouldIgnore,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          onCharacter,
        });
        void setClickThrough(shouldIgnore);
      }
    }).then((off) => {
      cleanupCursor = off;
    });

    return () => {
      cleanupCursor?.();
      void setClickThrough(false);
      void setPointerActive(false);
    };
  }, [hitTestFn, characterReady, pointerActive]);

  return null;
}

function SettingsModal() {
  const open = useCompanionStore((s) => s.settingsOpen);
  const setOpen = useCompanionStore((s) => s.setSettingsOpen);
  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-[800px] max-w-[800px] p-0 bg-transparent border-0 shadow-none overflow-hidden">
        <SettingsPanel onClose={() => setOpen(false)} />
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={() => setOpen(false)}>
          关闭
        </button>
      </form>
    </dialog>
  );
}

function CompanionWindow() {
  const {
    loading,
    error,
    modelPath,
    characterReady,
    modelLoading,
    configRevision,
    init,
    refreshConfig,
    clearError,
    setCharacterReady,
    setSettingsOpen,
  } = useCompanionStore();

  useSidecarError();

  const onModelLoaded = useCallback(() => {
    setCharacterReady(true);
    onCharacterModelReady();
  }, [setCharacterReady]);

  const onModelError = useCallback(
    (msg: string) => {
      setCharacterReady(false);
      useCompanionStore.setState({ error: msg });
    },
    [setCharacterReady],
  );

  useEffect(() => {
    void init().then(() => {
      if (isCompanionOverlay() && !useCompanionStore.getState().modelPath) {
        void openSettings();
      }
    });

    const onConfigChanged = (): void => {
      void refreshConfig();
    };

    if (isCompanionOverlay()) {
      let offConfig: (() => void) | undefined;
      void listenConfigChanged(onConfigChanged).then((fn) => {
        offConfig = fn;
      });
      return () => offConfig?.();
    }

    const onStorage = (ev: StorageEvent): void => {
      if (ev.key === "companion-config-changed") onConfigChanged();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [init, refreshConfig]);

  useEffect(() => {
    const stopPatrol = startPatrolWatcher();
    return () => stopPatrol();
  }, []);

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
      {!isCompanionOverlay() ? (
        <button
          type="button"
          className="absolute top-1 right-1 z-30 text-[10px] px-2 py-0.5 rounded bg-black/40 text-white/70 hover:text-white"
          onClick={() => setSettingsOpen(true)}
        >
          设置
        </button>
      ) : null}
      <div className="relative w-full h-full">
        <TextBubbleOverlay />
        <CharacterViewport
          modelPath={modelPath}
          configRevision={configRevision}
          onModelError={onModelError}
          onModelLoaded={onModelLoaded}
        />
      </div>

      {!characterReady && !modelPath ? (
        <div className="absolute inset-x-2 top-1/3 z-10 startup-panel text-center text-xs leading-relaxed">
          未加载 VRM 模型。请打开「设置」导入模型。
        </div>
      ) : null}

      {!characterReady && modelPath && modelLoading ? (
        <div className="absolute inset-x-2 top-1/3 z-10 startup-panel text-center text-xs leading-relaxed">
          正在加载 VRM 模型…
        </div>
      ) : null}

      {error ? (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 startup-panel text-red-300 text-xs">
          {error}
          <button type="button" className="ml-2 underline" onClick={clearError}>
            关闭
          </button>
        </div>
      ) : null}

      {!isCompanionOverlay() ? <SettingsModal /> : null}
    </div>
  );
}

function SettingsApp() {
  const { loading, init, refreshConfig } = useCompanionStore();

  useSidecarError();

  useEffect(() => {
    void init();
    void listenConfigChanged(() => {
      void refreshConfig();
    });
  }, [init, refreshConfig]);

  if (loading) {
    return (
      <div className="settings-app-shell flex h-full w-full items-center justify-center bg-base-300">
        <p className="text-base-content/70 text-sm">正在连接本地后台…</p>
      </div>
    );
  }

  return (
    <div className="settings-app-shell h-full w-full bg-base-100">
      <SettingsPanel standalone />
    </div>
  );
}

function AppRouter() {
  useEffect(() => {
    if (isCompanionOverlay()) {
      document.documentElement.removeAttribute("data-companion-view");
      document.title = "";
    } else if (isSettingsView()) {
      document.documentElement.setAttribute("data-companion-view", "settings");
      document.title = "FreeAnima Companion 设置";
    }
  }, []);

  if (isSettingsView()) {
    return <SettingsApp />;
  }
  return <CompanionWindow />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
