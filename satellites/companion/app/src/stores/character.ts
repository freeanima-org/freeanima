import { create } from "zustand";
import { getVrmBackend } from "@/renderer/VrmBackend.ts";
import {
  buildPerimeterWaypoints,
  buildWorkAreaCenter,
  clampPatrolPosition,
  nearestPerimeterEntry,
  patrolBoundsFromWaypoints,
  PATROL_CORNER_INDEX,
  patrolWaypoint,
  readScreenWorkArea,
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  type PatrolBounds,
  type ScreenPoint,
} from "@/lib/window-metrics.ts";
import { getPatrolScreen, getWindowPosition, isTauri, moveWindow } from "@/lib/tauri.ts";
import {
  IDLE_PATROL_DELAY_MS,
  interpolateJourneyPoint,
  journeyDurationMs,
  PATROL_PAUSE_MS,
  PATROL_SPEED_PX,
  shouldEnablePatrol,
} from "./character-patrol.ts";
import { companionDebug } from "@/lib/companion-debug.ts";
import type { LocomotionKind } from "@/renderer/VrmBackend.ts";

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
let characterModelReady = false;
let patrolPathRefresh: Promise<ScreenPoint[]> | null = null;
let startupWalkPending = true;
let introWalkActive = false;

function isTraveling(): boolean {
  return useCharacterStore.getState().patrolling || introWalkActive;
}

const COMPANION_STAGE_ID = "companion-stage";

function getBackend() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  try {
    return getVrmBackend(canvas);
  } catch {
    return null;
  }
}

function companionStageElement(): HTMLElement | null {
  return document.getElementById(COMPANION_STAGE_ID);
}

async function syncWindowPositionFromShell(): Promise<ScreenPoint> {
  if (isTauri()) {
    const point = await getWindowPosition();
    currentPosition = point;
    return point;
  }
  return readCurrentPositionSync();
}

function readCurrentPositionSync(): ScreenPoint {
  if (currentPosition) return currentPosition;
  const el = companionStageElement();
  if (el) {
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.left), y: Math.round(rect.top) };
  }
  return { x: 0, y: 0 };
}

function defaultWebCompanionPosition(): ScreenPoint {
  return patrolPoints[0] ?? { x: 0, y: 0 };
}

export function moveCompanionStage(x: number, y: number): void {
  const el = companionStageElement();
  if (!el) return;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  currentPosition = { x: Math.round(x), y: Math.round(y) };
}

async function refreshPatrolPath(): Promise<ScreenPoint[]> {
  if (isTauri()) {
    const bounds = await getPatrolScreen();
    patrolPoints = buildPerimeterWaypoints(
      {
        availLeft: bounds.availLeft,
        availTop: bounds.availTop,
        availWidth: bounds.availWidth,
        availHeight: bounds.availHeight,
      },
      { width: bounds.windowWidth, height: bounds.windowHeight },
    );
  } else {
    const screen = readScreenWorkArea();
    patrolPoints = buildPerimeterWaypoints(screen, {
      width: COMPANION_WINDOW_WIDTH,
      height: COMPANION_WINDOW_HEIGHT,
    });
  }
  patrolIndex = 0;
  patrolBounds = patrolBoundsFromWaypoints(patrolPoints);
  return patrolPoints;
}

function ensurePatrolPath(): Promise<ScreenPoint[]> {
  if (patrolPoints.length > 0) {
    return Promise.resolve(patrolPoints);
  }
  if (!patrolPathRefresh) {
    patrolPathRefresh = refreshPatrolPath().finally(() => {
      patrolPathRefresh = null;
    });
  }
  return patrolPathRefresh;
}

function nextPatrolPoint(): ScreenPoint {
  if (patrolPoints.length === 0) {
    return { x: 0, y: 0 };
  }
  const point = patrolPoints[patrolIndex]!;
  patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  return point;
}

function applyPosition(point: ScreenPoint): void {
  const clamped = clampPatrolPosition(point, patrolBounds);
  if (isTauri()) {
    void moveWindow(clamped.x, clamped.y);
  } else {
    moveCompanionStage(clamped.x, clamped.y);
  }
  currentPosition = clamped;
}

function locomotionKindForSegment(from: ScreenPoint, to: ScreenPoint): LocomotionKind {
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
  };
  syncTravelToBackend(true, PATROL_SPEED_PX, heading, locomotionKindForSegment(from, to));
  companionDebug("巡逻段开始", { from, to, durationMs: Math.round(durationMs) });
}

let schedulingPatrolStep = false;

async function scheduleNextPatrolStep(): Promise<void> {
  if (schedulingPatrolStep) return;
  if (!characterModelReady) return;
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
  patrolPausedUntilMs = performance.now() + PATROL_PAUSE_MS;
  syncIdleAtRest();

  if (introWalkActive) {
    introWalkActive = false;
    lastInteractionAt = performance.now();
    companionDebug("启动归位完成（左上角）");
  }
}

async function beginPatrolFromCurrentPosition(): Promise<void> {
  const points = await refreshPatrolPath();
  if (points.length === 0) return;

  const from = await syncWindowPositionFromShell();
  const { entry, nextIndex } = nearestPerimeterEntry(from, points);
  patrolIndex = nextIndex;

  const distancePx = Math.hypot(entry.x - from.x, entry.y - from.y);
  if (distancePx < 4) {
    patrolPausedUntilMs = performance.now() + PATROL_PAUSE_MS;
    companionDebug("已在巡逻边缘，直接开始", { from, entry, nextIndex });
    return;
  }

  patrolPausedUntilMs = 0;
  companionDebug("走向最近边缘后开始巡逻", { from, entry, nextIndex });
  startJourney(from, entry);
}

/** 双击角色：立即进入巡逻，先走到最近的工作区边缘 */
export async function enterPatrolMode(): Promise<void> {
  if (!characterModelReady) return;
  introWalkActive = false;
  activeJourney = null;
  lastInteractionAt = performance.now();
  useCharacterStore.getState().setPatrolling(true);
}

function tickJourney(): void {
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

  const { from, to, startMs, durationMs, heading } = activeJourney;
  const elapsed = performance.now() - startMs;
  const t = Math.min(1, elapsed / durationMs);
  const point = interpolateJourneyPoint(from, to, t);

  applyPosition(point);
  syncTravelToBackend(t < 1, PATROL_SPEED_PX, heading, locomotionKindForSegment(from, to));

  if (t >= 1) {
    finishActiveJourney();
  }
}

function tickPatrolTimer(): void {
  if (
    shouldEnablePatrol(
      lastInteractionAt,
      performance.now(),
      useCharacterStore.getState().patrolling,
      characterModelReady,
    )
  ) {
    companionDebug("空闲计时结束，开启巡逻", { idleMs: IDLE_PATROL_DELAY_MS });
    useCharacterStore.getState().setPatrolling(true);
  }
}

export function syncCompanionStagePosition(): void {
  if (isTauri()) return;
  const point = currentPosition ?? defaultWebCompanionPosition();
  moveCompanionStage(point.x, point.y);
}

/** VRM 加载完成后：从工作区中心归位到左上角 */
export function notifyCharacterModelReady(): void {
  characterModelReady = true;
  syncCompanionStagePosition();
  void runStartupWalkToHome();
}

async function readStartupSpawnPoint(): Promise<ScreenPoint> {
  if (isTauri()) {
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
  return buildWorkAreaCenter(readScreenWorkArea(), {
    width: COMPANION_WINDOW_WIDTH,
    height: COMPANION_WINDOW_HEIGHT,
  });
}

async function runStartupWalkToHome(): Promise<void> {
  if (!startupWalkPending) return;
  startupWalkPending = false;

  await ensurePatrolPath();
  if (patrolPoints.length === 0) return;

  const spawn = await readStartupSpawnPoint();
  const home = patrolWaypoint(patrolPoints, PATROL_CORNER_INDEX.home);

  applyPosition(spawn);
  currentPosition = spawn;
  patrolIndex = PATROL_CORNER_INDEX.topRight;

  introWalkActive = true;
  lastInteractionAt = performance.now();
  companionDebug("启动归位：从屏幕中心到左上角", { spawn, home });
  startJourney(spawn, home);
}

/** 用户交互时调用：停止巡逻并重置空闲计时 */
export function recordInteraction(): void {
  const wasPatrolling = useCharacterStore.getState().patrolling;
  lastInteractionAt = performance.now();
  introWalkActive = false;
  activeJourney = null;
  patrolPausedUntilMs = performance.now() + PATROL_PAUSE_MS;
  useCharacterStore.getState().setPatrolling(false);
  if (wasPatrolling) {
    companionDebug("用户交互，停止巡逻");
  }
}

/** 原生窗口拖拽结束后同步物理坐标 */
export async function syncCompanionWindowPosition(): Promise<void> {
  if (!isTauri()) return;
  await syncWindowPositionFromShell();
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
      const { from, to, startMs, durationMs, heading } = activeJourney;
      const t = Math.min(1, (performance.now() - startMs) / durationMs);
      syncTravelToBackend(
        t < 1,
        t < 1 ? PATROL_SPEED_PX : 0,
        heading,
        locomotionKindForSegment(from, to),
      );
      return;
    }
    syncIdleAtRest();
  },
}));

/** 启动旅程循环与空闲巡逻计时 */
export function startPatrolWatcher(): () => void {
  if (journeyFrame !== null) cancelAnimationFrame(journeyFrame);

  characterModelReady = false;
  startupWalkPending = true;
  introWalkActive = false;
  lastInteractionAt = performance.now();
  patrolPoints = [];
  void refreshPatrolPath();
  useCharacterStore.getState().setPatrolling(false);

  syncIdleAtRest();

  const loop = (): void => {
    tickJourney();
    journeyFrame = requestAnimationFrame(loop);
  };
  loop();

  patrolTimer = setInterval(tickPatrolTimer, 1000);

  return () => {
    if (journeyFrame !== null) cancelAnimationFrame(journeyFrame);
    journeyFrame = null;
    if (patrolTimer !== null) clearInterval(patrolTimer);
    patrolTimer = null;
    activeJourney = null;
    introWalkActive = false;
    startupWalkPending = true;
    characterModelReady = false;
    useCharacterStore.getState().setPatrolling(false);
    syncIdleAtRest();
  };
}

export { IDLE_PATROL_DELAY_MS };
