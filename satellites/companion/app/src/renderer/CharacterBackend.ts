export type EmotionKind = "neutral" | "joy" | "angry" | "sad" | "surprised" | "think" | "talk";

export type PetAction = "idle" | "walk" | "talk" | string;

export interface CharacterBackend {
  load(source: string): Promise<void>;
  setEmotion(emotion: EmotionKind, weight?: number): void;
  playAction(action: PetAction): void;
  /** 供壳层穿透：屏幕坐标是否在角色可点击区域内 */
  hitTest(screenX: number, screenY: number): boolean;
  dispose(): void;
}

export const VRM_EMOTION_MAP: Record<EmotionKind, string> = {
  neutral: "Neutral",
  joy: "Joy",
  angry: "Angry",
  sad: "Sorrow",
  surprised: "Surprised",
  think: "Blink",
  talk: "A",
};
