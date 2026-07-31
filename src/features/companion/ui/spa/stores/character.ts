import { create } from "zustand";
import {
  buildHomeCorner,
  buildHorizontalPatrolWaypoints,
  buildWorkAreaCenter,
  clampPatrolPosition,
  patrolBoundsForHorizontal,
  readScreenWorkArea,
  CHARACTER_FOOTPRINT_HEIGHT,
  CHARACTER_FOOTPRINT_WIDTH,
  type PatrolBounds,
  type ScreenPoint,
  type ScreenRect,
} from "@freeanima/features/companion/ui/spa/lib/window-metrics.ts";
import {
  getPatrolScreen,
  isCompanionOverlay,
} from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";
import {
  interpolateJourneyPoint,
  journeyDurationMs,
  patrolPauseMsFor,
  patrolSpeedPxFor,
  shouldEnablePatrol,
} from "./character-patrol.ts";
import { companionDebug } from "@freeanima/features/companion/ui/spa/lib/companion-debug.ts";
import type { LocomotionKind } from "@freeanima/features/companion/ui/spa/renderer/VrmBackend.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import { idlePatrolDelayMs } from "@freeanima/features/companion/shared/core/behavior.ts";

type CharacterState = {
  patrolling: boolean;
  setPatrolling: (patrolling: boolean) => void;
  syncTravelToBackend: () => void;
};

type Journey = {
  from: ScreenPoint;
  to: ScreenPoint;
  startMs: number;
  durationMs: number;
  heading: number;
};

let journeyFrame: number | null = null;
let patrolTimer: ReturnType<typeof setInterval> | null = null;
let patrolIndex = 0;
let patrolPoints: ScreenPoint[] = [];
let patrolBounds: PatrolBounds | null = null;
let activeJourney: Journey | null = null;
let currentPosition: ScreenPoint | null = null;
let patrolPausedUntilMs = 0;
let lastInteractionAt = performance.now();
let patrolPathRefresh: Promise<ScreenPoint[]> | null = null;
let startupWalkPending = true;
let introWalkActive = false;

function getBackend() {
  return useCompanionStore.getState().backendRef.current;
}

function isTraveling(): boolean {
  return useCharacterStore.getState().patrolling || introWalkActive;
}

async function syncWindowPositionFromShell(): Promise<ScreenPoint> {
  return readCurrentPositionSync();
}

function readCurrentPositionSync(): ScreenPoint {
  if (currentPosition) return currentPosition;
  const fromBackend = getBackend()?.getScreenPosition?.();
  if (fromBackend) return fromBackend;
  return { x: 0, y: 0 };
}

function defaultWebCompanionPosition(): ScreenPoint {
  return patrolPoints[0] ?? { x: 0, y: 0 };
}

function footprintSize(): { width: number; height: number } {
  return { width: CHARACTER_FOOTPRINT_WIDTH, height: CHARACTER_FOOTPRINT_HEIGHT };
}

/** 设置角色 footprint 左上角（窗内 CSS）；全屏 canvas 内屏坐标，不再移 DOM 舞台 */
export function setCharacterScreenPosition(x: number, y: number): void {
  const maxX = Math.max(
    0,
    (typeof window !== "undefined" ? window.innerWidth : 0) - CHARACTER_FOOTPRINT_WIDTH,
  );
  const maxY = Math.max(
    0,
    (typeof window !== "undefined" ? window.innerHeight : 0) - CHARACTER_FOOTPRINT_HEIGHT,
  );
  const cx = Math.round(Math.min(maxX, Math.max(0, x)));
  const cy = Math.round(Math.min(maxY, Math.max(0, y)));
  currentPosition = { x: cx, y: cy };
  getBackend()?.setScreenPosition?.(cx, cy);
}

/** @deprecated 使用 setCharacterScreenPosition */
export const moveCompanionStage = setCharacterScreenPosition;

async function readPatrolScreenAndWindow(): Promise<{
  screen: ScreenRect;
  window: { width: number; height: number };
}> {
  if (isCompanionOverlay()) {
    const bounds = await getPatrolScreen();
    return {
      screen: {
        availLeft: bounds.availLeft,
        availTop: bounds.availTop,
        availWidth: bounds.availWidth,
        availHeight: bounds.availHeight,
      },
      window: { width: bounds.windowWidth, height: bounds.windowHeight },
    };
  }
  return {
    screen: readScreenWorkArea(),
    window: footprintSize(),
  };
}

async function refreshPatrolPath(laneY: number): Promise<ScreenPoint[]> {
  const { screen, window } = await readPatrolScreenAndWindow();
  patrolPoints = buildHorizontalPatrolWaypoints(screen, window, laneY);
  patrolBounds = patrolBoundsForHorizontal(screen, window, laneY);
  patrolIndex = 0;
  return patrolPoints;
}

function ensurePatrolPath(): Promise<ScreenPoint[]> {
  if (patrolPoints.length >= 2) {
    return Promise.resolve(patrolPoints);
  }
  if (!patrolPathRefresh) {
    patrolPathRefresh = syncWindowPositionFromShell()
      .then((from) => refreshPatrolPath(from.y))
      .finally(() => {
        patrolPathRefresh = null;
      });
  }
  return patrolPathRefresh;
}

function nextPatrolPoint(): ScreenPoint {
  if (patrolPoints.length === 0) {
    return { x: 0, y: 0 };
  }
  const point = patrolPoints[patrolIndex];
  if (!point) return { x: 0, y: 0 };
  patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  return point;
}

function applyPosition(point: ScreenPoint): void {
  const clamped = clampPatrolPosition(point, patrolBounds);
  setCharacterScreenPosition(clamped.x, clamped.y);
  currentPosition = clamped;
}

function locomotionKindForSegment(from: ScreenPoint, to: ScreenPoint): LocomotionKind {
  if (patrolBounds && patrolBounds.minY === patrolBounds.maxY) {
    return "walk";
  }
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return dy > dx ? "climb" : "walk";
}

function syncTravelToBackend(
  moving: boolean,
  speedPxPerSec: number,
  heading: number,
  kind: LocomotionKind,
): void {
  getBackend()?.setTravelState({ moving, speedPxPerSec, heading, kind });
}

function syncIdleAtRest(): void {
  syncTravelToBackend(false, 0, 0, "walk");
}

function startJourney(from: ScreenPoint, to: ScreenPoint): void {
  if (!isTraveling()) return;

  const behavior = useCompanionStore.getState().behavior;
  const speed = patrolSpeedPxFor(behavior);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distancePx = Math.hypot(dx, dy);
  if (distancePx < 4) {
    patrolPausedUntilMs = performance.now() + patrolPauseMsFor(behavior);
    syncIdleAtRest();
    return;
  }

  const heading = Math.atan2(dx, dy);
  const durationMs = journeyDurationMs(distancePx, speed);
  activeJourney = {
    from,
    to,
    startMs: performance.now(),
    durationMs,
    heading,
  };
  syncTravelToBackend(true, speed, heading, locomotionKindForSegment(from, to));
  companionDebug("巡逻段开始", { from, to, durationMs: Math.round(durationMs) });
}

let schedulingPatrolStep = false;

async function scheduleNextPatrolStep(): Promise<void> {
  if (schedulingPatrolStep) return;
  if (!useCompanionStore.getState().characterReady) return;
  if (introWalkActive) return;
  if (!useCharacterStore.getState().patrolling || activeJourney) return;
  if (performance.now() < patrolPausedUntilMs) return;

  schedulingPatrolStep = true;
  try {
    await ensurePatrolPath();
    const from = await syncWindowPositionFromShell();
    startJourney(from, nextPatrolPoint());
  } finally {
    schedulingPatrolStep = false;
  }
}

function finishActiveJourney(): void {
  activeJourney = null;
  patrolPausedUntilMs = performance.now() + patrolPauseMsFor(useCompanionStore.getState().behavior);
  syncIdleAtRest();

  if (introWalkActive) {
    introWalkActive = false;
    lastInteractionAt = performance.now();
    companionDebug("启动归位完成（左上角）");
  }
}

async function beginPatrolFromCurrentPosition(): Promise<void> {
  const from = await syncWindowPositionFromShell();
  const points = await refreshPatrolPath(from.y);
  if (points.length < 2) {
    patrolPausedUntilMs =
      performance.now() + patrolPauseMsFor(useCompanionStore.getState().behavior);
    companionDebug("水平巡逻空间不足", { from, points });
    return;
  }

  const left = points[0];
  const right = points[1];
  if (!left || !right) {
    patrolPausedUntilMs =
      performance.now() + patrolPauseMsFor(useCompanionStore.getState().behavior);
    return;
  }
  patrolIndex = from.x - left.x > right.x - from.x ? 0 : 1;

  patrolPausedUntilMs = 0;
  companionDebug("在当前高度水平巡逻", { from, left, right, patrolIndex });
  startJourney(from, nextPatrolPoint());
}

export async function enterPatrolMode(): Promise<void> {
  const { characterReady, behavior } = useCompanionStore.getState();
  if (!characterReady || !behavior.double_click_patrol) return;
  introWalkActive = false;
  activeJourney = null;
  lastInteractionAt = performance.now();
  useCharacterStore.getState().setPatrolling(true);
}

function tickJourney(): void {
  if (!useCompanionStore.getState().characterReady) {
    if (activeJourney != null || introWalkActive) {
      activeJourney = null;
      introWalkActive = false;
    }
    syncIdleAtRest();
    return;
  }

  if (!activeJourney) {
    if (useCharacterStore.getState().patrolling) {
      void scheduleNextPatrolStep();
    } else {
      syncIdleAtRest();
    }
    return;
  }

  if (!isTraveling()) {
    activeJourney = null;
    syncIdleAtRest();
    return;
  }

  const behavior = useCompanionStore.getState().behavior;
  const speed = patrolSpeedPxFor(behavior);
  const { from, to, startMs, durationMs, heading } = activeJourney;
  const elapsed = performance.now() - startMs;
  const t = Math.min(1, elapsed / durationMs);
  const point = interpolateJourneyPoint(from, to, t);

  applyPosition(point);
  syncTravelToBackend(t < 1, speed, heading, locomotionKindForSegment(from, to));

  if (t >= 1) {
    finishActiveJourney();
  }
}

function tickPatrolTimer(): void {
  const { characterReady, behavior } = useCompanionStore.getState();
  if (
    shouldEnablePatrol(
      lastInteractionAt,
      performance.now(),
      useCharacterStore.getState().patrolling,
      characterReady,
      behavior,
    )
  ) {
    companionDebug("空闲计时结束，开启巡逻", { idleMs: idlePatrolDelayMs(behavior) });
    useCharacterStore.getState().setPatrolling(true);
  }
}

export function syncCompanionStagePosition(): void {
  const point = currentPosition ?? defaultWebCompanionPosition();
  setCharacterScreenPosition(point.x, point.y);
}

export function onCharacterModelReady(): void {
  syncCompanionStagePosition();
  void runStartupWalkToHome();
}

/** 切模时立刻打断巡逻 / 归位，避免旧模型继续播走路 */
export function onCharacterModelSwitch(): void {
  introWalkActive = false;
  activeJourney = null;
  useCharacterStore.getState().setPatrolling(false);
  syncIdleAtRest();
}

async function readStartupSpawnPoint(): Promise<ScreenPoint> {
  if (isCompanionOverlay()) {
    const bounds = await getPatrolScreen();
    return buildWorkAreaCenter(
      {
        availLeft: bounds.availLeft,
        availTop: bounds.availTop,
        availWidth: bounds.availWidth,
        availHeight: bounds.availHeight,
      },
      { width: bounds.windowWidth, height: bounds.windowHeight },
    );
  }
  return buildWorkAreaCenter(readScreenWorkArea(), footprintSize());
}

async function runStartupWalkToHome(): Promise<void> {
  const { behavior } = useCompanionStore.getState();
  if (!behavior.startup_walk_enabled) {
    startupWalkPending = false;
    return;
  }
  if (!startupWalkPending) return;
  startupWalkPending = false;

  const { screen } = await readPatrolScreenAndWindow();
  const spawn = await readStartupSpawnPoint();
  const home = buildHomeCorner(screen);

  applyPosition(spawn);
  currentPosition = spawn;

  introWalkActive = true;
  lastInteractionAt = performance.now();
  companionDebug("启动归位：从屏幕中心到左上角", { spawn, home });
  startJourney(spawn, home);
}

export function recordInteraction(): void {
  const wasPatrolling = useCharacterStore.getState().patrolling;
  lastInteractionAt = performance.now();
  introWalkActive = false;
  activeJourney = null;
  patrolPausedUntilMs = performance.now() + patrolPauseMsFor(useCompanionStore.getState().behavior);
  useCharacterStore.getState().setPatrolling(false);
  if (wasPatrolling) {
    companionDebug("用户交互，停止巡逻");
  }
}

export async function syncCompanionWindowPosition(): Promise<void> {
  const fromBackend = getBackend()?.getScreenPosition?.();
  if (fromBackend) {
    currentPosition = fromBackend;
    return;
  }
  if (currentPosition) return;
  currentPosition = { x: 0, y: 0 };
}

export const useCharacterStore = create<CharacterState>((set) => ({
  patrolling: false,

  setPatrolling(patrolling) {
    set({ patrolling });
    companionDebug(patrolling ? "进入巡逻模式" : "退出巡逻模式");
    if (!patrolling) {
      activeJourney = null;
      syncIdleAtRest();
      getBackend()?.resumeIdleMotion();
    } else {
      void beginPatrolFromCurrentPosition();
    }
  },

  syncTravelToBackend() {
    if (activeJourney) {
      const behavior = useCompanionStore.getState().behavior;
      const speed = patrolSpeedPxFor(behavior);
      const { from, to, startMs, durationMs, heading } = activeJourney;
      const t = Math.min(1, (performance.now() - startMs) / durationMs);
      syncTravelToBackend(t < 1, t < 1 ? speed : 0, heading, locomotionKindForSegment(from, to));
      return;
    }
    syncIdleAtRest();
  },
}));

export function startPatrolWatcher(): () => void {
  if (journeyFrame != null) cancelAnimationFrame(journeyFrame);

  startupWalkPending = true;
  introWalkActive = false;
  lastInteractionAt = performance.now();
  patrolPoints = [];
  patrolBounds = null;
  useCharacterStore.getState().setPatrolling(false);

  syncIdleAtRest();

  const loop = (): void => {
    tickJourney();
    journeyFrame = requestAnimationFrame(loop);
  };
  loop();

  patrolTimer = setInterval(tickPatrolTimer, 1000);

  return () => {
    if (journeyFrame != null) cancelAnimationFrame(journeyFrame);
    journeyFrame = null;
    if (patrolTimer != null) clearInterval(patrolTimer);
    patrolTimer = null;
    activeJourney = null;
    introWalkActive = false;
    startupWalkPending = true;
    useCharacterStore.getState().setPatrolling(false);
    syncIdleAtRest();
  };
}
