import { useEffect, useRef } from "react";
import { disposeVrmBackend, getVrmBackend } from "./VrmBackend.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import { loadCachedModelSource } from "@freeanima/features/companion/ui/spa/lib/model-cache.ts";
import { measureCharacterViewportSize } from "@freeanima/features/companion/ui/spa/lib/canvas-metrics.ts";
import { formatVrmLoadError } from "@freeanima/features/companion/ui/spa/lib/vrm-load-error.ts";
import { reportCompanionModelStatus } from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";

type Props = {
  modelPath: string;
  configRevision: number;
  onModelLoaded?: () => void;
  onModelError?: (message: string) => void;
};

export function VrmCanvas({ modelPath, configRevision, onModelLoaded, onModelError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const characterReady = useCompanionStore((s) => s.characterReady);
  const modelLoading = useCompanionStore((s) => s.modelLoading);
  const setHitTest = useCompanionStore((s) => s.setHitTestFn);
  const setModelLoading = useCompanionStore((s) => s.setModelLoading);
  const setBackend = useCompanionStore((s) => s.setBackend);
  const onModelLoadedRef = useRef(onModelLoaded);
  const onModelErrorRef = useRef(onModelError);
  const loadedModelRef = useRef<string | null>(null);

  onModelLoadedRef.current = onModelLoaded;
  onModelErrorRef.current = onModelError;

  const hideWhileLoading = Boolean(modelPath.trim()) && !characterReady && modelLoading;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {};
    }

    if (!modelPath.trim()) {
      setHitTest(null);
      setBackend(null);
      setModelLoading(false);
      loadedModelRef.current = null;
      disposeVrmBackend();
      void reportCompanionModelStatus({ loading: false, error: null });
      return () => {};
    }

    let cancelled = false;
    let revokeModelUrl: (() => void) | undefined;
    const backend = getVrmBackend(canvas);
    setBackend(backend);

    const resize = (): void => {
      const container = canvas.parentElement;
      const { width, height } = measureCharacterViewportSize(container, canvas);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      backend.resize(width, height);
    };

    const container = canvas.parentElement;
    const resizeObserver =
      container &&
      new ResizeObserver(() => {
        resize();
      });
    resizeObserver?.observe(container ?? canvas);

    resize();
    requestAnimationFrame(resize);
    window.addEventListener("resize", resize);

    const motionConfig = { library: motionLibrary, slots: motionSlots };

    const reloadOnly =
      loadedModelRef.current === modelPath && useCompanionStore.getState().characterReady;

    if (reloadOnly) {
      void backend.reloadAnimations(motionConfig).catch((e) => {
        onModelErrorRef.current?.(formatVrmLoadError(e));
      });
      setHitTest((x, y) => backend.hitTest(x, y));
    } else {
      if (loadedModelRef.current !== modelPath) {
        loadedModelRef.current = null;
        useCompanionStore.getState().setCharacterReady(false);
      }

      setModelLoading(true);
      void reportCompanionModelStatus({ loading: true, error: null });
      // 下载前清场，避免失败时残留旧模型
      backend.beginModelSwitch();
      loadedModelRef.current = modelPath;

      void (async () => {
        try {
          const cached = await loadCachedModelSource(modelPath);
          revokeModelUrl = cached.revoke;
          if (cancelled) return;

          await backend.load(cached.url, motionConfig);
          if (cancelled) return;
          resize();
          setHitTest((x, y) => backend.hitTest(x, y));
          void reportCompanionModelStatus({ loading: false, error: null });
          onModelLoadedRef.current?.();
        } catch (e) {
          if (!cancelled) {
            loadedModelRef.current = null;
            backend.beginModelSwitch();
            const message = formatVrmLoadError(e);
            void reportCompanionModelStatus({ loading: false, error: message });
            onModelErrorRef.current?.(message);
          }
        } finally {
          if (!cancelled) setModelLoading(false);
        }
      })();
    }

    return () => {
      cancelled = true;
      revokeModelUrl?.();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [
    modelPath,
    configRevision,
    motionLibrary,
    motionSlots,
    setHitTest,
    setModelLoading,
    setBackend,
  ]);

  useEffect(() => {
    return () => {
      disposeVrmBackend();
      setBackend(null);
    };
  }, [setBackend]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      style={hideWhileLoading ? { visibility: "hidden" } : undefined}
    />
  );
}
