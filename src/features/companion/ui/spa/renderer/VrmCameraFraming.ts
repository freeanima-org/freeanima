import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

export type VrmFramingState = {
  modelSize: THREE.Vector3;
  lookAtY: number;
  centerX: number;
  footY: number;
  headY: number;
};

/** 首次加载：脚底对齐 y=0，并计算取景参数（调用前需已设好展示姿态，勿用 T 字姿） */
export function computeVrmFraming(vrm: VRM): {
  basePosition: THREE.Vector3;
  framing: VrmFramingState;
} {
  vrm.scene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(vrm.scene);
  const center = box.getCenter(new THREE.Vector3());
  const basePosition = new THREE.Vector3(-center.x, -box.min.y, -center.z);

  vrm.scene.position.copy(basePosition);
  vrm.scene.updateMatrixWorld(true);

  const grounded = new THREE.Box3().setFromObject(vrm.scene);
  const modelSize = grounded.getSize(new THREE.Vector3());
  const groundedCenter = grounded.getCenter(new THREE.Vector3());
  const footY = grounded.min.y;
  const headY = grounded.max.y;
  const spanY = Math.max(headY - footY, 0.01);

  return {
    basePosition: basePosition.clone(),
    framing: {
      modelSize,
      footY,
      headY,
      centerX: groundedCenter.x,
      lookAtY: footY + spanY * 0.5,
    },
  };
}

export type VrmCameraFramingOpts = {
  paddingX?: number;
  /** 脚底下方留白（相对身高） */
  bottomMarginRatio?: number;
  /** 头顶上方额外空间，给摆臂/跳起留余量 */
  topHeadroomRatio?: number;
};

/** 根据已知模型尺寸调整相机：脚底贴近视口底边，上方留 headroom */
export function applyVrmCameraFraming(
  camera: THREE.PerspectiveCamera,
  framing: VrmFramingState,
  opts?: VrmCameraFramingOpts,
): void {
  const paddingX = opts?.paddingX ?? 1.06;
  const bottomMarginRatio = opts?.bottomMarginRatio ?? 0.035;
  const topHeadroomRatio = opts?.topHeadroomRatio ?? 0.34;
  const aspect = camera.aspect > 0 ? camera.aspect : 1;
  const fovRad = (camera.fov * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);
  const { modelSize, centerX, footY, headY } = framing;

  const bodySpan = Math.max(headY - footY, modelSize.y * 0.85, 0.01);
  const bottomMargin = bodySpan * bottomMarginRatio;
  const topHeadroom = bodySpan * topHeadroomRatio;
  const verticalSpan = bodySpan + topHeadroom + bottomMargin;

  const distForHeight = verticalSpan / (2 * halfTan);
  const distForWidth = (modelSize.x * paddingX) / (2 * halfTan * aspect);
  const distance = Math.max(distForHeight, distForWidth, 0.35);

  const lookAtY = (footY - bottomMargin + headY + topHeadroom) / 2;

  framing.lookAtY = lookAtY;
  camera.position.set(centerX, lookAtY, distance);
  camera.lookAt(centerX, lookAtY, 0);
  camera.updateProjectionMatrix();
}

export function frameVrmInView(
  vrm: VRM,
  camera: THREE.PerspectiveCamera,
  opts?: VrmCameraFramingOpts,
): THREE.Vector3 {
  const { basePosition, framing } = computeVrmFraming(vrm);
  applyVrmCameraFraming(camera, framing, opts);
  return basePosition;
}
