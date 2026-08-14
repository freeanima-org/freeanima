import {
  closestCenter,
  pointerWithin,
  type Collision,
  type CollisionDetection,
  type ClientRect,
} from "@dnd-kit/core";

import { LIST_ROOT_DND_ID, isListDndId, isListRootDndId, isTaskDndId } from "./dnd-ids.ts";

/** 任务拖拽时优先命中指针下的清单，避免 closestCenter 误选远处任务行 */
export function pickTaskDragCollisions(collisions: Collision[]): Collision[] {
  if (collisions.length === 0) return collisions;
  const listHit = collisions.find((c) => isListDndId(c.id));
  if (listHit) return [listHit];
  return collisions;
}

export function isPointInRect(
  point: { x: number; y: number },
  rect: Pick<ClientRect, "left" | "right" | "top" | "bottom">,
): boolean {
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  );
}

/**
 * 清单拖拽：指针落在根区矩形内时强制命中根（优先于下方清单）。
 * 否则指针下有具体清单则取清单，仅有根则取根。
 */
export function pickListDragCollisions(collisions: Collision[]): Collision[] {
  if (collisions.length === 0) return collisions;
  const listHit = collisions.find((c) => isListDndId(c.id));
  if (listHit) return [listHit];
  const rootHit = collisions.find((c) => isListRootDndId(c.id));
  if (rootHit) return [rootHit];
  return collisions;
}

/** 记录真实指针坐标（碰撞检测每帧都会带），避免用拖拽块中心误判 before/after */
export function createTaskListCollisionDetection(
  onPointerY?: (y: number | null) => void,
): CollisionDetection {
  return (args) => {
    onPointerY?.(args.pointerCoordinates?.y ?? null);

    if (isTaskDndId(args.active.id)) {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        return pickTaskDragCollisions(pointerCollisions);
      }
      return closestCenter(args);
    }
    if (isListDndId(args.active.id)) {
      const pointer = args.pointerCoordinates;
      if (pointer) {
        const rootRect = args.droppableRects.get(LIST_ROOT_DND_ID);
        if (rootRect && isPointInRect(pointer, rootRect)) {
          return [{ id: LIST_ROOT_DND_ID }];
        }
      }
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        return pickListDragCollisions(pointerCollisions);
      }
      return closestCenter(args);
    }
    return closestCenter(args);
  };
}

/** 无指针跟踪的默认碰撞检测（单测 / 简单场景） */
export const taskListCollisionDetection: CollisionDetection = createTaskListCollisionDetection();
