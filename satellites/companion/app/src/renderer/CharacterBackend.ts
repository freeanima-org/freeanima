import type { MotionBindConfig } from "./VrmAnimationPlayer.ts";

export type EmotionKind = "neutral" | "joy" | "angry" | "sad" | "surprised" | "think";

export type BodyZone = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

export interface CharacterBackend {
  load(source: string, motionConfig: MotionBindConfig): Promise<void>;
  setEmotion(emotion: EmotionKind, weight?: number): void;
  playMotion(file: string): void;
  playZoneMotion(zone: BodyZone): void;
  resumeIdleMotion(): void;
  /** 供壳层穿透：屏幕坐标是否在角色可点击区域内 */
  hitTest(screenX: number, screenY: number): boolean;
  pickBodyZone(screenX: number, screenY: number): BodyZone | null;
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
