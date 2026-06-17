import { StrictMode, useCallback, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { CharacterViewport } from "@/components/CharacterViewport.tsx";
import { SettingsPanel } from "@/components/SettingsPanel.tsx";
import { useCompanionStore } from "@/stores/companion.ts";
import { startPatrolWatcher } from "@/stores/character.ts";
import { companionDebug } from "@/lib/companion-debug.ts";
import {
  isSettingsRoute,
  isTauri,
  listenConfigChanged,
  listenCursorPosition,
  listenSidecarError,
  openSettings,
  setClickThrough,
  setPointerActive,
} from "@/lib/tauri.ts";

function ClickThroughManager() {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const modelReady = useCompanionStore((s) => s.modelReady);
  const pointerActive = useCompanionStore((s) => s.pointerActive);
  const ignoringRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || !hitTestFn || !modelReady) return;

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
  }, [hitTestFn, modelReady, pointerActive]);

  return null;
}

function CompanionWindow() {
  const { loading, error, modelPath, modelReady, modelLoading, init, clearError, setModelReady } =
    useCompanionStore();

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
    void init().then(() => {
      if (isTauri() && !useCompanionStore.getState().modelPath) {
        void openSettings();
      }
    });
    if (!isTauri()) return;
    let offSidecar: (() => void) | undefined;
    void listenSidecarError((msg) => {
      useCompanionStore.setState({
        error: `后台服务启动失败：${msg}。请确认 exe 与 sidecar 在同一目录，或改用安装包。`,
        loading: false,
      });
    }).then((fn) => {
      offSidecar = fn;
    });
    let offConfig: (() => void) | undefined;
    void listenConfigChanged(() => {
      void useCompanionStore.getState().init();
    }).then((fn) => {
      offConfig = fn;
    });
    return () => {
      offSidecar?.();
      offConfig?.();
    };
  }, [init]);

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
      <CharacterViewport
        modelPath={modelPath}
        onBackendReady={onModelReady}
        onModelError={onModelError}
        onModelLoaded={onModelLoaded}
      />

      {!modelReady && !loading && !modelPath ? (
        <div className="absolute inset-x-2 top-1/3 z-10 startup-panel text-center text-xs leading-relaxed">
          未加载 VRM 模型。请从系统托盘打开「设置」导入或填写模型路径。
        </div>
      ) : null}

      {!modelReady && !loading && modelPath && modelLoading ? (
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
    </div>
  );
}

function SettingsApp() {
  const { loading, init } = useCompanionStore();

  useEffect(() => {
    void init();
    if (!isTauri()) return;
    let offSidecar: (() => void) | undefined;
    void listenSidecarError((msg) => {
      useCompanionStore.setState({
        error: `后台服务启动失败：${msg}`,
        loading: false,
      });
    }).then((fn) => {
      offSidecar = fn;
    });
    return () => offSidecar?.();
  }, [init]);

  if (loading) {
    return (
      <div className="settings-window flex items-center justify-center">
        <p className="text-white/70 text-sm">正在连接本地后台…</p>
      </div>
    );
  }

  return (
    <div className="settings-window">
      <SettingsPanel standalone />
    </div>
  );
}

function AppRouter() {
  if (isSettingsRoute()) {
    return <SettingsApp />;
  }
  return <CompanionWindow />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
