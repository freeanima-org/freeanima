import type { ComponentType } from "react";

export type EntityOverlayProps = {
  id: number;
  component: string;
  onClose: () => void;
};

export type EntityOverlayComponent = ComponentType<EntityOverlayProps>;

const overlays = new Map<string, EntityOverlayComponent>();

export function registerEntityOverlay(component: string, Overlay: EntityOverlayComponent): void {
  overlays.set(component, Overlay);
}

export function getEntityOverlay(component: string): EntityOverlayComponent | undefined {
  return overlays.get(component);
}

export function listEntityOverlayComponents(): readonly string[] {
  return [...overlays.keys()];
}

export function resetEntityOverlaysForTests(): void {
  overlays.clear();
}
