import {
  closestCenter,
  pointerWithin,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

import { isListDndId, isTaskDndId } from "./dnd-ids.ts";

/** 任务拖拽时优先命中指针下的清单，避免 closestCenter 误选远处任务行 */
export function pickTaskDragCollisions(collisions: Collision[]): Collision[] {
  if (collisions.length === 0) return collisions;
  const listHit = collisions.find((c) => isListDndId(c.id));
  if (listHit) return [listHit];
  return collisions;
}

export const taskListCollisionDetection: CollisionDetection = (args) => {
  if (isTaskDndId(args.active.id)) {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pickTaskDragCollisions(pointerCollisions);
    }
    return closestCenter(args);
  }
  return closestCenter(args);
};
