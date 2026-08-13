import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

/** VRM 运行时 scene 根节点（绕过 @pixiv/three-vrm 在 oxlint 下解析为 error 的类型） */
export function getVrmScene(vrm: VRM): THREE.Object3D {
  const scene: unknown = Reflect.get(vrm, "scene");
  if (scene instanceof THREE.Object3D) return scene;
  throw new Error("VRM scene 缺失或类型无效");
}

/** 按 humanoid 骨骼名取归一化节点；不存在时返回 null */
export function getVrmNormalizedBoneNode(vrm: VRM, boneName: string): THREE.Object3D | null {
  const humanoid: unknown = Reflect.get(vrm, "humanoid");
  if (humanoid == null || typeof humanoid !== "object") return null;
  const getNode: unknown = Reflect.get(humanoid, "getNormalizedBoneNode");
  if (typeof getNode !== "function") return null;
  const node: unknown = Reflect.apply(getNode, humanoid, [boneName]);
  return node instanceof THREE.Object3D ? node : null;
}
