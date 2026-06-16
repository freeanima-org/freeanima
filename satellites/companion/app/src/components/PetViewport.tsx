import { useRef, type PointerEvent } from "react";
import { VrmCanvas } from "@/renderer/VrmCanvas.tsx";
import { useCompanionStore } from "@/stores/companion.ts";
import { usePetStore } from "@/stores/pet.ts";
import { isTauri } from "@/lib/tauri.ts";
import { WEB_PET_HEIGHT, WEB_PET_WIDTH } from "@/lib/window-metrics.ts";

type Props = {
  modelPath: string;
  onBackendReady?: () => void;
  onModelLoaded?: () => void;
  onModelError?: (message: string) => void;
};

export function PetViewport({ modelPath, onBackendReady, onModelLoaded, onModelError }: Props) {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const modelReady = useCompanionStore((s) => s.modelReady);
  const walking = usePetStore((s) => s.walking);
  const toggleWalking = usePetStore((s) => s.toggleWalking);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || !modelReady) return;

    const down = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!down) return;

    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > 8) return;

    if (hitTestFn && !hitTestFn(event.clientX, event.clientY)) return;
    toggleWalking();
  };

  const webMode = !isTauri();

  return (
    <div
      id="pet-stage"
      className={webMode ? "pet-stage-web" : "absolute inset-0 pointer-events-auto"}
      style={webMode ? { width: WEB_PET_WIDTH, height: WEB_PET_HEIGHT } : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      title={webMode ? (walking ? "点击切换为休息" : "点击切换为散步") : undefined}
    >
      <VrmCanvas
        modelPath={modelPath}
        onBackendReady={onBackendReady}
        onModelLoaded={onModelLoaded}
        onModelError={onModelError}
      />
      {webMode && modelReady ? (
        <span className="pet-stage-badge">{walking ? "散步" : "休息"}</span>
      ) : null}
    </div>
  );
}
