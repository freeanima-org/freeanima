import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

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
    const node = humanoid.getNormalizedBoneNode(
      boneName as Parameters<typeof humanoid.getNormalizedBoneNode>[0],
    );
    if (!node) continue;
    node.getWorldPosition(boneWorld);
    const distSq = hitPoint.distanceToSquared(boneWorld);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestZone = BONE_ZONE[boneName]!;
    }
  }

  return bestZone;
}

export class VrmBodyPicker {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  pickBodyZone(
    vrm: VRM,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    screenX: number,
    screenY: number,
  ): BodyZone | null {
    const rect = canvas.getBoundingClientRect();
    this.ndc.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObject(vrm.scene, true);
    if (hits.length === 0) return null;

    return resolveBodyZoneFromPoint(vrm, hits[0]!.point);
  }
}
