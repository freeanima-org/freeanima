import { useEffect, useRef } from "react";
import { disposeVrmBackend, getVrmBackend } from "./VrmBackend.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { notifyCharacterModelReady, useCharacterStore } from "@/stores/character.ts";
import { loadCachedModelSource } from "@/lib/model-cache.ts";
import { measureCharacterViewportSize } from "@/lib/canvas-metrics.ts";
import { resolveSidecarOrigin } from "@/lib/sidecar.ts";

type Props = {
  modelPath: string;
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

export function VrmCanvas({ modelPath, onModelLoaded, onModelError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setHitTest = useCompanionStore((s) => s.setHitTestFn);
  const setModelLoading = useCompanionStore((s) => s.setModelLoading);
  const onModelLoadedRef = useRef(onModelLoaded);
  const onModelErrorRef = useRef(onModelError);

  onModelLoadedRef.current = onModelLoaded;
  onModelErrorRef.current = onModelError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!modelPath.trim()) {
      setHitTest(null);
      setModelLoading(false);
      return;
    }

    let cancelled = false;
    let revokeModelUrl: (() => void) | undefined;
    const backend = getVrmBackend(canvas);

    const resize = (): void => {
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

    setModelLoading(true);

    void (async () => {
      try {
        const remoteUrl = await resolveModelUrl(modelPath);
        const cached = await loadCachedModelSource(remoteUrl);
        revokeModelUrl = cached.revoke;
        if (cancelled) return;

        await backend.load(cached.url);
        if (cancelled) return;
        resize();
        requestAnimationFrame(resize);

        setHitTest((x, y) => backend.hitTest(x, y));
        setModelLoading(false);
        useCharacterStore.getState().syncTravelToBackend();
        notifyCharacterModelReady();
        onModelLoadedRef.current?.();
      } catch (e) {
        if (cancelled) return;
        setHitTest(null);
        setModelLoading(false);
        onModelErrorRef.current?.(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
      revokeModelUrl?.();
      setHitTest(null);
      setModelLoading(false);
      disposeVrmBackend();
    };
  }, [modelPath, setHitTest, setModelLoading]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
}
