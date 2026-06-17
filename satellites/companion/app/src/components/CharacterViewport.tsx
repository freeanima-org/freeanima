import { useRef, type PointerEvent } from "react";
import { VrmCanvas } from "@/renderer/VrmCanvas.tsx";
import { useCompanionStore } from "@/stores/companion.ts";
import {
  enterPatrolMode,
  moveCompanionStage,
  recordInteraction,
  syncCompanionWindowPosition,
} from "@/stores/character.ts";
import { getVrmBackend } from "@/renderer/VrmBackend.ts";
import { companionDebug } from "@/lib/companion-debug.ts";
import { getWindowPosition, isTauri, moveWindow } from "@/lib/tauri.ts";
import { WEB_COMPANION_HEIGHT, WEB_COMPANION_WIDTH } from "@/lib/window-metrics.ts";

const DRAG_THRESHOLD_PX = 8;
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_DIST_PX = 16;
const COMPANION_STAGE_ID = "companion-stage";

type Props = {
  modelPath: string;
  onBackendReady?: () => void;
  onModelLoaded?: () => void;
  onModelError?: (message: string) => void;
};

export function CharacterViewport({
  modelPath,
  onBackendReady,
  onModelLoaded,
  onModelError,
}: Props) {
  const hitTestFn = useCompanionStore((s) => s.hitTestFn);
  const modelReady = useCompanionStore((s) => s.modelReady);
  const pointerDownRef = useRef<{
    clientX: number;
    clientY: number;
    stageX: number;
    stageY: number;
    winX: number;
    winY: number;
    winReady: boolean;
    accumDx: number;
    accumDy: number;
  } | null>(null);
  const draggingRef = useRef(false);
  const lastClickRef = useRef<{ timeMs: number; x: number; y: number } | null>(null);

  const onCharacterHit = (clientX: number, clientY: number): boolean => {
    return !hitTestFn || hitTestFn(clientX, clientY);
  };

  const readStageOrigin = (): { x: number; y: number } => {
    const el = document.getElementById(COMPANION_STAGE_ID);
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
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
    if (event.button !== 0 || !modelReady) {
      companionDebug("pointerdown 忽略", { button: event.button, modelReady });
      return;
    }
    useCompanionStore.getState().setPointerActive(true);
    recordInteraction();
    draggingRef.current = false;
    const origin = readStageOrigin();
    pointerDownRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      stageX: origin.x,
      stageY: origin.y,
      winX: 0,
      winY: 0,
      winReady: !isTauri(),
      accumDx: 0,
      accumDy: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    if (isTauri()) {
      void getWindowPosition().then(({ x, y }) => {
        const down = pointerDownRef.current;
        if (!down) return;
        down.winX = x;
        down.winY = y;
        down.winReady = true;
      });
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const down = pointerDownRef.current;
    if (!down) return;

    const moved = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
    if (!draggingRef.current) {
      if (moved <= DRAG_THRESHOLD_PX) return;
      draggingRef.current = true;
    }

    if (isTauri() && draggingRef.current && down.winReady) {
      down.accumDx += event.movementX;
      down.accumDy += event.movementY;
      const scale = window.devicePixelRatio || 1;
      void moveWindow(
        down.winX + Math.round(down.accumDx * scale),
        down.winY + Math.round(down.accumDy * scale),
      );
      return;
    }

    if (!isTauri() && draggingRef.current) {
      moveCompanionStage(
        down.stageX + (event.clientX - down.clientX),
        down.stageY + (event.clientY - down.clientY),
      );
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;

    const down = pointerDownRef.current;
    pointerDownRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!down || !modelReady) {
      draggingRef.current = false;
      useCompanionStore.getState().setPointerActive(false);
      return;
    }

    const moved = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
    draggingRef.current = false;
    useCompanionStore.getState().setPointerActive(false);
    if (isTauri()) {
      void syncCompanionWindowPosition();
    }
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

  const webMode = !isTauri();

  return (
    <div
      id={COMPANION_STAGE_ID}
      className={webMode ? "companion-stage-web" : "absolute inset-0 pointer-events-auto"}
      style={webMode ? { width: WEB_COMPANION_WIDTH, height: WEB_COMPANION_HEIGHT } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <VrmCanvas
        modelPath={modelPath}
        onBackendReady={onBackendReady}
        onModelLoaded={onModelLoaded}
        onModelError={onModelError}
      />
    </div>
  );
}
