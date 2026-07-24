import { useRef, type PointerEvent } from "react";
import { VrmCanvas } from "@freeanima/features/companion/ui/spa/renderer/VrmCanvas.tsx";
import { TextBubbleOverlay } from "@freeanima/features/companion/ui/spa/components/TextBubbleOverlay.tsx";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import {
  enterPatrolMode,
  setCharacterScreenPosition,
  recordInteraction,
  syncCompanionWindowPosition,
} from "@freeanima/features/companion/ui/spa/stores/character.ts";
import { getVrmBackend } from "@freeanima/features/companion/ui/spa/renderer/VrmBackend.ts";
import { companionDebug } from "@freeanima/features/companion/ui/spa/lib/companion-debug.ts";

const DRAG_THRESHOLD_PX = 8;
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_DIST_PX = 16;
const COMPANION_STAGE_ID = "companion-stage";

function readCharacterOrigin(): { x: number; y: number } {
  const backend = useCompanionStore.getState().backendRef.current;
  const pos = backend?.getScreenPosition?.();
  if (pos) return pos;
  return { x: 0, y: 0 };
}

type Props = {
  modelPath: string;
  configRevision: number;
  onModelLoaded?: () => void;
  onModelError?: (message: string) => void;
};

export function CharacterViewport({
  modelPath,
  configRevision,
  onModelLoaded,
  onModelError,
}: Props) {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const characterReady = useCompanionStore((s) => s.characterReady);
  const pointerDownRef = useRef<{
    clientX: number;
    clientY: number;
    stageX: number;
    stageY: number;
  } | null>(null);
  const draggingRef = useRef(false);
  const lastClickRef = useRef<{ timeMs: number; x: number; y: number } | null>(null);

  const onCharacterHit = (clientX: number, clientY: number): boolean => {
    return !hitTestFn || hitTestFn(clientX, clientY);
  };

  const isDoubleClick = (clientX: number, clientY: number): boolean => {
    const last = lastClickRef.current;
    const now = performance.now();
    lastClickRef.current = { timeMs: now, x: clientX, y: clientY };
    if (!last) return false;
    return (
      now - last.timeMs <= DOUBLE_CLICK_MS &&
      Math.hypot(clientX - last.x, clientY - last.y) <= DOUBLE_CLICK_DIST_PX
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || !characterReady) {
      companionDebug("pointerdown 忽略", { button: event.button, characterReady });
      return;
    }
    // 全屏容器：仅在角色（或后续拖拽中）上开始交互
    if (!onCharacterHit(event.clientX, event.clientY)) {
      return;
    }
    useCompanionStore.getState().setPointerActive(true);
    recordInteraction();
    draggingRef.current = false;
    const origin = readCharacterOrigin();
    pointerDownRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      stageX: origin.x,
      stageY: origin.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const down = pointerDownRef.current;
    if (!down) return;

    const moved = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
    if (!draggingRef.current) {
      if (moved <= DRAG_THRESHOLD_PX) return;
      draggingRef.current = true;
    }

    setCharacterScreenPosition(
      down.stageX + (event.clientX - down.clientX),
      down.stageY + (event.clientY - down.clientY),
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;

    const down = pointerDownRef.current;
    pointerDownRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!down || !characterReady) {
      draggingRef.current = false;
      useCompanionStore.getState().setPointerActive(false);
      return;
    }

    const moved = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
    draggingRef.current = false;
    useCompanionStore.getState().setPointerActive(false);
    void syncCompanionWindowPosition();
    if (moved > DRAG_THRESHOLD_PX) {
      companionDebug("pointerup 视为拖拽", { moved: Math.round(moved) });
      lastClickRef.current = null;
      return;
    }

    if (
      onCharacterHit(event.clientX, event.clientY) &&
      isDoubleClick(event.clientX, event.clientY)
    ) {
      companionDebug("pointerup 双击进入巡逻");
      void enterPatrolMode();
      return;
    }

    const canvas = document.querySelector("canvas");
    if (!canvas) {
      companionDebug("pointerup 无 canvas");
      return;
    }
    try {
      const backend = getVrmBackend(canvas);
      let zone = backend.pickBodyZone(event.clientX, event.clientY);
      if (!zone && onCharacterHit(event.clientX, event.clientY)) {
        zone = "torso";
        companionDebug("pointerup 射线未命中，回退为 torso", {
          x: event.clientX,
          y: event.clientY,
        });
      }
      if (zone) {
        companionDebug("pointerup 触发动作", { zone, hasClips: backend.hasMotionClips() });
        backend.playZoneMotion(zone);
      } else {
        companionDebug("pointerup 未识别部位", {
          x: event.clientX,
          y: event.clientY,
          hit: onCharacterHit(event.clientX, event.clientY),
        });
      }
    } catch (e) {
      companionDebug("pointerup backend 不可用", e);
    }
  };

  return (
    <div
      id={COMPANION_STAGE_ID}
      className="companion-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <VrmCanvas
        modelPath={modelPath}
        configRevision={configRevision}
        {...(onModelLoaded !== undefined ? { onModelLoaded } : {})}
        {...(onModelError !== undefined ? { onModelError } : {})}
      />
      <TextBubbleOverlay />
    </div>
  );
}
