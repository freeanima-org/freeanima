import {
  closestCenter,
  pointerWithin,
  type Collision,
  type CollisionDetection,
  type ClientRect,
} from "@dnd-kit/core";

import { PROJECT_ROOT_DND_ID, isProjectRootDndId, isProjectTreeDndId } from "./project-dnd-ids.ts";

export function isPointInRect(
  point: { x: number; y: number },
  rect: Pick<ClientRect, "left" | "right" | "top" | "bottom">,
): boolean {
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  );
}

export function pickProjectTreeCollisions(collisions: Collision[]): Collision[] {
  if (collisions.length === 0) return collisions;
  const treeHit = collisions.find((c) => isProjectTreeDndId(c.id));
  if (treeHit) return [treeHit];
  const rootHit = collisions.find((c) => isProjectRootDndId(c.id));
  if (rootHit) return [rootHit];
  return collisions;
}

export function createProjectTreeCollisionDetection(
  onPointerY?: (y: number | null) => void,
): CollisionDetection {
  return (args) => {
    onPointerY?.(args.pointerCoordinates?.y ?? null);

    if (!isProjectTreeDndId(args.active.id)) {
      return closestCenter(args);
    }

    const pointer = args.pointerCoordinates;
    if (pointer) {
      const rootRect = args.droppableRects.get(PROJECT_ROOT_DND_ID);
      if (rootRect && isPointInRect(pointer, rootRect)) {
        return [{ id: PROJECT_ROOT_DND_ID }];
      }
    }

    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pickProjectTreeCollisions(pointerCollisions);
    }
    return closestCenter(args);
  };
}
