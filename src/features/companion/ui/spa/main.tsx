import { StrictMode, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Spinner } from "@freeanima/frontend/ui-kit";
import { CharacterViewport } from "@freeanima/features/companion/ui/spa/components/CharacterViewport.tsx";
import { TextBubbleOverlay } from "@freeanima/features/companion/ui/spa/components/TextBubbleOverlay.tsx";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import {
  onCharacterModelReady,
  startPatrolWatcher,
} from "@freeanima/features/companion/ui/spa/stores/character.ts";
import { useSidecarError } from "@freeanima/features/companion/ui/spa/hooks/useSidecarError.ts";
import {
  isCompanionOverlay,
  listenConfigChanged,
  listenCursorPosition,
  openSettings,
  setClickThrough,
  setPointerActive,
} from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";
import { companionDebug } from "@freeanima/features/companion/ui/spa/lib/companion-debug.ts";
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
        <Spinner className="size-6 text-primary" aria-label="加载中" />
      </div>
    );
  }

  return (
    <div className="companion-overlay">
      <ClickThroughManager />
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
          未加载 VRM 模型。请从主窗口顶栏打开「设置」导入模型。
        </div>
      ) : null}

      {!characterReady && modelPath && modelLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <Spinner className="size-6 text-primary" aria-label="加载中" />
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
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl === null) throw new Error("root element not found");
createRoot(rootEl).render(
  <StrictMode>
    <CompanionWindow />
  </StrictMode>,
);
