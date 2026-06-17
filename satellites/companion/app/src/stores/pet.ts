import { create } from "zustand";
import type { EmotionKind } from "@/renderer/CharacterBackend.ts";
import { getVrmBackend } from "@/renderer/VrmBackend.ts";
import { isTauri, moveWindow } from "@/lib/tauri.ts";
import {
  buildPerimeterWaypoints,
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  readScreenWorkArea,
  WEB_PET_HEIGHT,
  WEB_PET_WIDTH,
  type ScreenPoint,
} from "@/lib/window-metrics.ts";
import type { PetEvent } from "@/lib/types.ts";

type PetState = {
  walking: boolean;
  emotion: EmotionKind;
  walkTarget: { x: number; y: number } | null;
  setWalking: (walking: boolean) => void;
  toggleWalking: () => void;
  handlePetEvent: (event: PetEvent) => void;
  syncActionToBackend: () => void;
};

type Journey = {
  from: ScreenPoint;
  to: ScreenPoint;
  startMs: number;
  durationMs: number;
  heading: number;
  distancePx: number;
};

let journeyFrame: number | null = null;
let patrolIndex = 0;
let patrolPoints: ScreenPoint[] = [];
let activeJourney: Journey | null = null;
let currentPosition: ScreenPoint | null = null;
let patrolPausedUntilMs = 0;

const PET_STAGE_ID = "pet-stage";
const MIN_JOURNEY_MS = 1200;
/** 每段巡逻结束后停留时长（ms） */
const PATROL_PAUSE_MS = 10_000;
/** 模型就绪后首次开走前的短暂停顿（ms） */
const INITIAL_PATROL_PAUSE_MS = 800;
/** 目标巡逻速度（px/s），实际步频由瞬时速度决定 */
const PATROL_SPEED_PX = 95;

let petModelReady = false;

function getBackend() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  try {
    return getVrmBackend(canvas);
  } catch {
    return null;
  }
}

function petStageElement(): HTMLElement | null {
  return document.getElementById(PET_STAGE_ID);
}

function initialPatrolPosition(): ScreenPoint {
  if (patrolPoints.length === 0) {
    refreshPatrolPath();
  }
  return patrolPoints[0]!;
}

function defaultWebPetPosition(): ScreenPoint {
  return initialPatrolPosition();
}

export function movePetStage(x: number, y: number): void {
  const el = petStageElement();
  if (!el) return;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  currentPosition = { x: Math.round(x), y: Math.round(y) };
}

function readCurrentPosition(): ScreenPoint {
  if (currentPosition) return currentPosition;
  const el = petStageElement();
  if (el) {
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.left), y: Math.round(rect.top) };
  }
  return defaultWebPetPosition();
}

function refreshPatrolPath(): ScreenPoint[] {
  const screen = readScreenWorkArea();
  const windowSize = isTauri()
    ? { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT }
    : { width: WEB_PET_WIDTH, height: WEB_PET_HEIGHT };

  patrolPoints = buildPerimeterWaypoints(screen, windowSize);
  patrolIndex = 0;
  return patrolPoints;
}

function nextPatrolPoint(): ScreenPoint {
  if (patrolPoints.length === 0) {
    refreshPatrolPath();
  }
  const point = patrolPoints[patrolIndex]!;
  patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  return point;
}

function journeyDurationMs(distancePx: number): number {
  const bySpeed = (distancePx / PATROL_SPEED_PX) * 1000;
  return Math.max(MIN_JOURNEY_MS, bySpeed);
}

/** smoothstep 对时间的导数（用于瞬时速度） */
function smoothstepSpeed(t: number, distancePx: number, durationMs: number): number {
  if (t <= 0 || t >= 1) return 0;
  const deriv = 6 * t * (1 - t);
  return (distancePx * deriv) / (durationMs / 1000);
}

function applyPosition(point: ScreenPoint): void {
  if (isTauri()) {
    void moveWindow(point.x, point.y);
  } else {
    movePetStage(point.x, point.y);
  }
  currentPosition = point;
}

function syncTravelToBackend(moving: boolean, speedPxPerSec: number, heading: number): void {
  getBackend()?.setTravelState({ moving, speedPxPerSec, heading });
}

function syncIdleAtRest(): void {
  syncTravelToBackend(false, 0, 0);
}

function startJourney(to: ScreenPoint): void {
  if (!usePetStore.getState().walking) return;

  const from = readCurrentPosition();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distancePx = Math.hypot(dx, dy);
  if (distancePx < 4) {
    patrolPausedUntilMs = performance.now() + PATROL_PAUSE_MS;
    syncIdleAtRest();
    return;
  }

  const heading = Math.atan2(dx, dy);
  const durationMs = journeyDurationMs(distancePx);
  activeJourney = {
    from,
    to,
    startMs: performance.now(),
    durationMs,
    heading,
    distancePx,
  };
}

function scheduleNextPatrolStep(): void {
  if (!petModelReady) return;
  if (!usePetStore.getState().walking || activeJourney) return;
  if (performance.now() < patrolPausedUntilMs) return;
  startJourney(nextPatrolPoint());
}

function tickJourney(): void {
  if (!activeJourney) {
    if (usePetStore.getState().walking) {
      scheduleNextPatrolStep();
    } else {
      syncIdleAtRest();
    }
    return;
  }

  if (!usePetStore.getState().walking) {
    activeJourney = null;
    syncIdleAtRest();
    return;
  }

  const { from, to, startMs, durationMs, heading, distancePx } = activeJourney;
  const elapsed = performance.now() - startMs;
  const t = Math.min(1, elapsed / durationMs);
  const eased = t * t * (3 - 2 * t);
  const point = {
    x: Math.round(from.x + (to.x - from.x) * eased),
    y: Math.round(from.y + (to.y - from.y) * eased),
  };
  const speedPxPerSec = smoothstepSpeed(t, distancePx, durationMs);

  applyPosition(point);
  syncTravelToBackend(t < 1, speedPxPerSec, heading);

  if (t >= 1) {
    activeJourney = null;
    patrolPausedUntilMs = performance.now() + PATROL_PAUSE_MS;
    syncIdleAtRest();
  }
}

export function syncPetStagePosition(): void {
  if (isTauri()) return;
  const point = currentPosition ?? initialPatrolPosition();
  movePetStage(point.x, point.y);
}

/** VRM 加载完成后调用：对齐位置并允许巡逻开始 */
export function notifyPetModelReady(): void {
  petModelReady = true;
  patrolPausedUntilMs = performance.now() + INITIAL_PATROL_PAUSE_MS;
  syncPetStagePosition();
}

export const usePetStore = create<PetState>((set, get) => ({
  walking: false,
  emotion: "neutral",
  walkTarget: null,

  setWalking(walking) {
    set({ walking });
    if (!walking) {
      activeJourney = null;
      syncIdleAtRest();
    }
  },

  toggleWalking() {
    get().setWalking(!get().walking);
  },

  syncActionToBackend() {
    if (activeJourney) {
      const { heading, distancePx, startMs, durationMs } = activeJourney;
      const t = Math.min(1, (performance.now() - startMs) / durationMs);
      syncTravelToBackend(t < 1, smoothstepSpeed(t, distancePx, durationMs), heading);
      return;
    }
    if (get().walking) {
      syncIdleAtRest();
      return;
    }
    syncIdleAtRest();
  },

  handlePetEvent(event) {
    const backend = getBackend();
    switch (event.type) {
      case "say": {
        backend?.playAction("talk");
        const duration = event.duration_ms ?? 8000;
        setTimeout(() => {
          backend?.playAction("idle");
          usePetStore.getState().syncActionToBackend();
        }, duration);
        break;
      }
      case "emote": {
        const emotion = event.emotion as EmotionKind;
        set({ emotion });
        backend?.setEmotion(emotion, event.weight ?? 1);
        break;
      }
      case "move": {
        startJourney({ x: event.x, y: event.y });
        set({ walkTarget: { x: event.x, y: event.y } });
        break;
      }
      case "walk": {
        get().setWalking(event.enabled);
        break;
      }
    }
  },
}));

/** 启动巡逻；仅在位移过程中播放走路动画 */
export function startPetBehavior(): () => void {
  if (journeyFrame !== null) cancelAnimationFrame(journeyFrame);

  petModelReady = false;
  refreshPatrolPath();
  usePetStore.getState().setWalking(true);

  if (!isTauri()) {
    const initial = initialPatrolPosition();
    movePetStage(initial.x, initial.y);
    if (patrolPoints.length > 1) {
      patrolIndex = 1;
    }
  }

  syncIdleAtRest();
  patrolPausedUntilMs = Number.POSITIVE_INFINITY;

  const loop = (): void => {
    tickJourney();
    journeyFrame = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    if (journeyFrame !== null) cancelAnimationFrame(journeyFrame);
    journeyFrame = null;
    activeJourney = null;
    petModelReady = false;
    usePetStore.getState().setWalking(false);
    syncIdleAtRest();
  };
}

/** @deprecated 使用 startPetBehavior */
export const startWalkStateMachine = startPetBehavior;
