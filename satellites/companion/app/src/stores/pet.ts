import { create } from "zustand";
import type { EmotionKind } from "@/renderer/CharacterBackend.ts";
import { getVrmBackend } from "@/renderer/VrmBackend.ts";
import { moveWindow } from "@/lib/tauri.ts";
import type { PetEvent } from "@/lib/types.ts";

type PetState = {
  walking: boolean;
  toolBubble: string;
  emotion: EmotionKind;
  walkTarget: { x: number; y: number } | null;
  setWalking: (walking: boolean) => void;
  handlePetEvent: (event: PetEvent) => void;
  tickWalk: () => void;
};

let walkTimer: ReturnType<typeof setInterval> | null = null;

function getBackend() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  try {
    return getVrmBackend(canvas);
  } catch {
    return null;
  }
}

export const usePetStore = create<PetState>((set, get) => ({
  walking: false,
  toolBubble: "",
  emotion: "neutral",
  walkTarget: null,

  setWalking(walking) {
    set({ walking });
    const backend = getBackend();
    backend?.playAction(walking ? "walk" : "idle");
  },

  handlePetEvent(event) {
    const backend = getBackend();
    switch (event.type) {
      case "say": {
        set({ toolBubble: event.text });
        backend?.playAction("talk");
        const duration = event.duration_ms ?? 8000;
        setTimeout(() => {
          if (usePetStore.getState().toolBubble === event.text) {
            set({ toolBubble: "" });
            backend?.playAction("idle");
          }
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
        void moveWindow(event.x, event.y);
        set({ walkTarget: { x: event.x, y: event.y } });
        break;
      }
      case "walk": {
        get().setWalking(event.enabled);
        break;
      }
    }
  },

  tickWalk() {
    if (!get().walking) return;
    const backend = getBackend();
    backend?.playAction("walk");
  },
}));

export function startWalkStateMachine(): () => void {
  if (walkTimer) clearInterval(walkTimer);

  usePetStore.getState().setWalking(true);

  walkTimer = setInterval(() => {
    usePetStore.getState().tickWalk();
  }, 100);

  const wanderTimer = setInterval(() => {
    if (!usePetStore.getState().walking) return;
    const maxX = window.screen.availWidth - 320;
    const maxY = window.screen.availHeight - 400;
    const x = Math.floor(Math.random() * Math.max(1, maxX));
    const y = Math.floor(Math.random() * Math.max(1, maxY));
    void moveWindow(x, y);
  }, 12_000);

  return () => {
    if (walkTimer) clearInterval(walkTimer);
    walkTimer = null;
    clearInterval(wanderTimer);
    usePetStore.getState().setWalking(false);
  };
}
