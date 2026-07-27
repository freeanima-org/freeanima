import { useSyncExternalStore } from "react";

import {
  getCompactImmersive,
  setCompactImmersive,
  subscribeCompactImmersive,
} from "./compact-immersive-store.ts";

export function useCompactImmersive(): boolean {
  return useSyncExternalStore(subscribeCompactImmersive, getCompactImmersive, () => false);
}

export function useSetCompactImmersive(): typeof setCompactImmersive {
  return setCompactImmersive;
}
