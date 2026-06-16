import { useEffect, useRef } from "react";
import { disposeVrmBackend, getVrmBackend } from "./VrmBackend.ts";
import { useCompanionStore } from "@/stores/companion.ts";

type Props = {
  modelPath: string;
  onBackendReady?: () => void;
};

export function VrmCanvas({ modelPath, onBackendReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setHitTest = useCompanionStore((s) => s.setHitTestFn);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const backend = getVrmBackend(canvas);
    setHitTest((x, y) => backend.hitTest(x, y));

    const resize = (): void => {
      backend.resize(canvas.clientWidth, canvas.clientHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    void backend.load(modelPath).then(() => {
      onBackendReady?.();
    });

    return () => {
      window.removeEventListener("resize", resize);
      setHitTest(null);
      disposeVrmBackend();
    };
  }, [modelPath, onBackendReady, setHitTest]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
}
