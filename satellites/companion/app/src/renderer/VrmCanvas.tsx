import { useEffect, useRef } from "react";
import { disposeVrmBackend, getVrmBackend } from "./VrmBackend.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { resolveSidecarOrigin } from "@/lib/sidecar.ts";
import { isTauri } from "@/lib/tauri.ts";

type Props = {
  modelPath: string;
  onBackendReady?: () => void;
  onModelLoaded?: () => void;
  onModelError?: (message: string) => void;
};

export function VrmCanvas({ modelPath, onBackendReady, onModelLoaded, onModelError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setHitTest = useCompanionStore((s) => s.setHitTestFn);
  const onBackendReadyRef = useRef(onBackendReady);
  const onModelLoadedRef = useRef(onModelLoaded);
  const onModelErrorRef = useRef(onModelError);

  onBackendReadyRef.current = onBackendReady;
  onModelLoadedRef.current = onModelLoaded;
  onModelErrorRef.current = onModelError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!modelPath.trim()) {
      setHitTest(null);
      return;
    }

    let cancelled = false;
    const backend = getVrmBackend(canvas);

    const resize = (): void => {
      backend.resize(canvas.clientWidth, canvas.clientHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    void (async () => {
      try {
        let source = modelPath;
        if (isTauri() && source.startsWith("/")) {
          const base = await resolveSidecarOrigin();
          source = `${base}${source}`;
        }
        await backend.load(source);
        if (cancelled) return;
        setHitTest((x, y) => backend.hitTest(x, y));
        onModelLoadedRef.current?.();
        onBackendReadyRef.current?.();
      } catch (e) {
        if (cancelled) return;
        setHitTest(null);
        onModelErrorRef.current?.(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      setHitTest(null);
      disposeVrmBackend();
    };
  }, [modelPath, setHitTest]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
}
