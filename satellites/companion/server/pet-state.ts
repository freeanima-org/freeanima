import type { ServerWebSocket } from "bun";

export type EmotionKind = "neutral" | "joy" | "angry" | "sad" | "surprised" | "think" | "talk";

export type PetEvent =
  | { type: "say"; text: string; duration_ms?: number }
  | { type: "emote"; emotion: EmotionKind; weight?: number }
  | { type: "move"; x: number; y: number }
  | { type: "walk"; enabled: boolean };

export type PetWsData = {
  cleanups: Array<() => void>;
};

const petSockets = new Set<ServerWebSocket<PetWsData>>();

export function broadcastPetEvent(event: PetEvent): void {
  const raw = JSON.stringify(event);
  for (const ws of petSockets) {
    try {
      ws.send(raw);
    } catch {
      /* socket may be closing */
    }
  }
}

export function handlePetWsOpen(ws: ServerWebSocket<PetWsData>): void {
  ws.data = { cleanups: [] };
  petSockets.add(ws);
}

export function handlePetWsClose(ws: ServerWebSocket<PetWsData>): void {
  petSockets.delete(ws);
  for (const off of ws.data?.cleanups ?? []) off();
}
