import { useEffect, useRef } from "react";
import { disposeVrmBackend, getVrmBackend } from "./VrmBackend.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { loadCachedModelSource } from "@/lib/model-cache.ts";
import { measureCharacterViewportSize } from "@/lib/canvas-metrics.ts";
import { resolveSidecarOrigin } from "@/lib/sidecar.ts";

type Props = {
  modelPath: string;
  configRevision: number;
  onModelLoaded?: () => void;
  onModelError?: (message: string) => void;
};

async function resolveModelUrl(modelPath: string): Promise<string> {
  if (modelPath.startsWith("http://") || modelPath.startsWith("https://")) {
    return modelPath;
  }
  if (modelPath.startsWith("/")) {
    const base = await resolveSidecarOrigin();
    return `${base}${modelPath}`;
  }
  return modelPath;
}

export function VrmCanvas({ modelPath, configRevision, onModelLoaded, onModelError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const setHitTest = useCompanionStore((s) => s.setHitTestFn);
  const setModelLoading = useCompanionStore((s) => s.setModelLoading);
  const setBackend = useCompanionStore((s) => s.setBackend);
  const onModelLoadedRef = useRef(onModelLoaded);
  const onModelErrorRef = useRef(onModelError);
  const loadedModelRef = useRef<string | null>(null);

  onModelLoadedRef.current = onModelLoaded;
  onModelErrorRef.current = onModelError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!modelPath.trim()) {
      setHitTest(null);
      setBackend(null);
      setModelLoading(false);
      loadedModelRef.current = null;
      return;
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
        onModelErrorRef.current?.(e instanceof Error ? e.message : String(e));
      });
      setHitTest((x, y) => backend.hitTest(x, y));
      return () => {
        resizeObserver?.disconnect();
        window.removeEventListener("resize", resize);
      };
    }

    setModelLoading(true);
    loadedModelRef.current = modelPath;

    void (async () => {
      try {
        const remoteUrl = await resolveModelUrl(modelPath);
        const cached = await loadCachedModelSource(remoteUrl);
        revokeModelUrl = cached.revoke;
        if (cancelled) return;

        await backend.load(cached.url, motionConfig);
        if (cancelled) return;
        resize();
        setHitTest((x, y) => backend.hitTest(x, y));
        onModelLoadedRef.current?.();
      } catch (e) {
        if (!cancelled) {
          loadedModelRef.current = null;
          onModelErrorRef.current?.(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    })();

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

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
