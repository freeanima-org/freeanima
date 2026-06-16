export const COMPANION_PLATFORM = "companion";

export type StreamApiEvent = {
  event: string;
  data: Record<string, unknown>;
};

export type CompanionConfig = {
  app_id: string;
  instance_id: string;
  relay_ws_url: string;
  hub_url: string;
  model_path: string;
};

export type PetEvent =
  | { type: "say"; text: string; duration_ms?: number }
  | { type: "emote"; emotion: string; weight?: number }
  | { type: "move"; x: number; y: number }
  | { type: "walk"; enabled: boolean };
