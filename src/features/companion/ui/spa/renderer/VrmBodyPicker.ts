import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

import { getVrmNormalizedBoneNode, getVrmScene } from "./vrm-three-access.ts";

export type BodyZone = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

const BONE_ZONE: Record<string, BodyZone> = {
  head: "head",
  neck: "head",
  hips: "torso",
  spine: "torso",
  chest: "torso",
  upperChest: "torso",
  leftShoulder: "leftArm",
  leftUpperArm: "leftArm",
  leftLowerArm: "leftArm",
  leftHand: "leftArm",
  rightShoulder: "rightArm",
  rightUpperArm: "rightArm",
  rightLowerArm: "rightArm",
  rightHand: "rightArm",
  leftUpperLeg: "leftLeg",
  leftLowerLeg: "leftLeg",
  leftFoot: "leftLeg",
  leftToes: "leftLeg",
  rightUpperLeg: "rightLeg",
  rightLowerLeg: "rightLeg",
  rightFoot: "rightLeg",
  rightToes: "rightLeg",
};

/** 将 VRM humanoid 骨骼名映射为可点击部位 */
export function boneNameToZone(boneName: string): BodyZone | null {
  return BONE_ZONE[boneName] ?? null;
}

/** 根据射线命中点，选取最近的 humanoid 骨骼并归并为部位 */
export function resolveBodyZoneFromPoint(vrm: VRM, hitPoint: THREE.Vector3): BodyZone | null {
  const humanoid = vrm.humanoid;
  if (!humanoid) return null;

  let bestZone: BodyZone | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  const boneWorld = new THREE.Vector3();

  for (const boneName of Object.keys(BONE_ZONE)) {
    const node = getVrmNormalizedBoneNode(vrm, boneName);
    if (!node) continue;
    node.getWorldPosition(boneWorld);
    const distSq = hitPoint.distanceToSquared(boneWorld);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      const zone = BONE_ZONE[boneName];
      if (zone === undefined) continue;
      bestZone = zone;
    }
  }

  return bestZone;
}

export class VrmBodyPicker {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  private setRayFromScreen(
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    screenX: number,
    screenY: number,
    canvasRect?: DOMRect,
  ): boolean {
    const rect = canvasRect ?? canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.ndc.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, camera);
    return true;
  }

  /** 屏幕坐标是否命中角色 mesh（供 click-through / 点击共用） */
  hitTest(
    vrm: VRM,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    screenX: number,
    screenY: number,
    canvasRect?: DOMRect,
  ): boolean {
    if (!this.setRayFromScreen(camera, canvas, screenX, screenY, canvasRect)) return false;
    // 只要有交点即可；阈值 1 时 three 仍会扫完全部 mesh，粗滤在 Backend 侧
    return this.raycaster.intersectObject(getVrmScene(vrm), true).length > 0;
  }

  pickBodyZone(
    vrm: VRM,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    screenX: number,
    screenY: number,
    canvasRect?: DOMRect,
  ): BodyZone | null {
    if (!this.setRayFromScreen(camera, canvas, screenX, screenY, canvasRect)) return null;
    const hits = this.raycaster.intersectObject(getVrmScene(vrm), true);
    if (hits.length === 0) return null;

    const hit = hits[0];
    if (!hit) return null;

    return resolveBodyZoneFromPoint(vrm, hit.point);
  }
}
