import * as THREE from "three";
import type {
  GLTFLoader,
  GLTFLoaderPlugin,
  GLTFParser,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import type { VRM } from "@pixiv/three-vrm";
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";

/** VRMAnimationLoaderPlugin 在 oxlint 下可能解析为 error */
export function registerVrmAnimationLoader(loader: GLTFLoader): void {
  loader.register((parser: GLTFParser): GLTFLoaderPlugin => {
    const Ctor: unknown = VRMAnimationLoaderPlugin;
    if (typeof Ctor !== "function") {
      throw new Error("VRMAnimationLoaderPlugin 不可用");
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 第三方/库类型边界
    return Reflect.construct(Ctor as new (p: GLTFParser) => GLTFLoaderPlugin, [parser]);
  });
}

export function firstVrmAnimation(gltf: { userData: Record<string, unknown> }): unknown {
  const raw: unknown = gltf.userData.vrmAnimations;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw[0];
}

/** createVRMAnimationClip 在 oxlint 下可能解析为 error；边界窄化为 AnimationClip */
export function createVrmAnimationClip(vrma: unknown, vrm: VRM): THREE.AnimationClip {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 第三方/库类型边界
  const clip: unknown = createVRMAnimationClip(vrma as VRMAnimation, vrm);
  if (clip instanceof THREE.AnimationClip) return clip;
  throw new Error("VRMA 片段无效");
}
