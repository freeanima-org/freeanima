import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import {
  CHARACTER_FOOTPRINT_HEIGHT,
  CHARACTER_FOOTPRINT_WIDTH,
} from "@freeanima/features/companion/shared/constants.ts";

export type VrmFramingState = {
  modelSize: THREE.Vector3;
  lookAtY: number;
  centerX: number;
  footY: number;
  headY: number;
  /** 正交取景半高（含头脚留白）；全屏用 zoom 缩到 footprint */
  viewHalfH: number;
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
      viewHalfH: spanY / 2,
    },
  };
}

export type VrmCameraFramingOpts = {
  paddingX?: number;
  /** 脚底下方留白（相对身高） */
  bottomMarginRatio?: number;
  /** 头顶上方额外空间，给摆臂/跳起留余量 */
  topHeadroomRatio?: number;
  /** 当前画布高度（CSS px）；与 footprintHeight 一起锁定屏幕身高 */
  canvasHeight?: number;
  /** 角色目标屏幕身高（CSS px） */
  footprintHeight?: number;
  /**
   * 是否按模型宽度相对画布拉远。
   * 全屏伴侣应为 false（避免宽屏/动作时整体缩小）；设置页小预览可为 true。
   */
  fitWidth?: boolean;
  /** fitWidth 时使用的画布宽高比；默认 footprint 宽高比 */
  framingAspect?: number;
};

function resolveVerticalSpan(
  framing: VrmFramingState,
  bottomMarginRatio: number,
  topHeadroomRatio: number,
): { bodySpan: number; bottomMargin: number; topHeadroom: number; verticalSpan: number } {
  const { modelSize, footY, headY } = framing;
  const bodySpan = Math.max(headY - footY, modelSize.y * 0.85, 0.01);
  const bottomMargin = bodySpan * bottomMarginRatio;
  const topHeadroom = bodySpan * topHeadroomRatio;
  return {
    bodySpan,
    bottomMargin,
    topHeadroom,
    verticalSpan: bodySpan + topHeadroom + bottomMargin,
  };
}

/** 根据已知模型尺寸调整相机：脚底锚点稳定；屏幕身高由调用方用 zoom 控制 */
export function applyVrmCameraFraming(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  framing: VrmFramingState,
  opts?: VrmCameraFramingOpts,
): void {
  const paddingX = opts?.paddingX ?? 1.06;
  const bottomMarginRatio = opts?.bottomMarginRatio ?? 0.035;
  const topHeadroomRatio = opts?.topHeadroomRatio ?? 0.34;
  const fitWidth = opts?.fitWidth ?? false;
  const framingAspect =
    opts?.framingAspect ?? CHARACTER_FOOTPRINT_WIDTH / CHARACTER_FOOTPRINT_HEIGHT;

  const { modelSize, centerX, footY, headY } = framing;
  const { bottomMargin, topHeadroom, verticalSpan } = resolveVerticalSpan(
    framing,
    bottomMarginRatio,
    topHeadroomRatio,
  );
  const lookAtY = (footY - bottomMargin + headY + topHeadroom) / 2;
  framing.lookAtY = lookAtY;
  framing.viewHalfH = verticalSpan / 2;

  if (camera instanceof THREE.OrthographicCamera) {
    // 伴侣全屏：正交避免拖到角落产生透视；视锥半高固定，半宽由画布 aspect 在 applyScreenPosition 补齐
    let halfH = framing.viewHalfH;
    let halfW = halfH * (framingAspect > 0 ? framingAspect : 1);
    if (fitWidth) {
      halfW = Math.max(halfW, (modelSize.x * paddingX) / 2);
      halfH = Math.max(halfH, halfW / (framingAspect > 0 ? framingAspect : 1));
      framing.viewHalfH = halfH;
    }
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 0.1;
    camera.far = 100;
    camera.position.set(centerX, lookAtY, 10);
    camera.lookAt(centerX, lookAtY, 0);
    camera.updateProjectionMatrix();
    return;
  }

  const fovRad = (camera.fov * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);

  // 设置页小预览仍用透视 + OrbitControls
  let distance = verticalSpan / (2 * halfTan);

  if (fitWidth) {
    const aspect = framingAspect > 0 ? framingAspect : camera.aspect || 1;
    const distForWidth = (modelSize.x * paddingX) / (2 * halfTan * aspect);
    distance = Math.max(distance, distForWidth);
  }

  distance = Math.max(distance, 0.35);

  camera.position.set(centerX, lookAtY, distance);
  camera.lookAt(centerX, lookAtY, 0);
  camera.updateProjectionMatrix();
}

export function frameVrmInView(
  vrm: VRM,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  opts?: VrmCameraFramingOpts,
): THREE.Vector3 {
  const { basePosition, framing } = computeVrmFraming(vrm);
  applyVrmCameraFraming(camera, framing, opts);
  return basePosition;
}
