import type { MotionBindConfig } from "./VrmAnimationPlayer.ts";

export type EmotionKind = "neutral" | "joy" | "angry" | "sad" | "surprised" | "think";

export type BodyZone = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

export interface CharacterBackend {
  load(source: string, motionConfig: MotionBindConfig): Promise<void>;
  setEmotion(emotion: EmotionKind, weight?: number): void;
  playMotion(file: string): void;
  playZoneMotion(zone: BodyZone): void;
  resumeIdleMotion(): void;
  /** 供壳层穿透：屏幕坐标是否在角色 mesh 上 */
  hitTest(screenX: number, screenY: number): boolean;
  pickBodyZone(screenX: number, screenY: number): BodyZone | null;
  /** footprint 左上角（窗内 CSS） */
  setScreenPosition?(x: number, y: number): void;
  getScreenPosition?(): { x: number; y: number };
  getHeadScreenPosition?(): { x: number; y: number } | null;
  /** 仅气泡显示时打开，避免空转算头顶 AABB */
  setBubbleTracking?(enabled: boolean): void;
  dispose(): void;
}

export const VRM_EMOTION_MAP: Record<EmotionKind, string> = {
  neutral: "Neutral",
  joy: "Joy",
  angry: "Angry",
  sad: "Sorrow",
  surprised: "Surprised",
  think: "Blink",
};
