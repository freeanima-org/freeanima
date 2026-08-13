import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  type BodyZone,
  type CharacterBackend,
  type EmotionKind,
  VRM_EMOTION_MAP,
} from "./CharacterBackend.ts";
import {
  applyVrmCameraFraming,
  computeVrmFraming,
  type VrmFramingState,
} from "./VrmCameraFraming.ts";
import { resolveFacingOffsetY } from "./vrm-facing.ts";
import { getVrmNormalizedBoneNode, getVrmScene } from "./vrm-three-access.ts";
import { VrmAnimationPlayer, type MotionBindConfig } from "./VrmAnimationPlayer.ts";
import { VrmBodyPicker } from "./VrmBodyPicker.ts";
import { sanitizeMtoonOutlinesForOrtho } from "./sanitize-mtoon-outlines.ts";
import { loadCachedModelSource } from "@freeanima/features/companion/ui/spa/lib/model-cache.ts";
import type { MotionSlotId } from "@freeanima/features/companion/shared/companion-schema.ts";
import {
  CHARACTER_FOOTPRINT_HEIGHT,
  CHARACTER_FOOTPRINT_WIDTH,
} from "@freeanima/features/companion/shared/constants.ts";
import { VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";

const LOOK_AT_PROXY_NAME = "lookAtQuaternionProxy";

/** 全屏 overlay 下限制 DPR，避免整屏 ×2 填充满载 */
const MAX_PIXEL_RATIO = 1;
/** 气泡锚点：头顶再上抬的屏幕边距（px） */
const BUBBLE_ABOVE_TOP_PX = 14;
/** 命中粗滤屏幕 AABB 外扩（px） */
const HIT_SCREEN_PAD_PX = 16;
/** 粗滤 AABB 刷新间隔 */
const HIT_BOUNDS_TTL_MS = 100;

function attachLookAtQuaternionProxy(vrm: VRM): void {
  if (!vrm.lookAt) return;
  const scene = getVrmScene(vrm);
  if (scene.getObjectByName(LOOK_AT_PROXY_NAME)) return;
  const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
  const proxyObj = proxy as unknown as THREE.Object3D;
  proxyObj.name = LOOK_AT_PROXY_NAME;
  scene.add(proxyObj);
}

const MIN_WALK_SPEED_PX = 8;

export type LocomotionKind = "walk" | "climb";

export type TravelState = {
  moving: boolean;
  speedPxPerSec: number;
  heading: number;
  kind: LocomotionKind;
};

export type ScreenPointPx = { x: number; y: number };

export class VrmBackend implements CharacterBackend {
  private scene: THREE.Scene;
  /** 全屏伴侣用正交：屏内平移不产生透视变形 */
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  /** 屏内平移 */
  private displayRoot = new THREE.Group();
  /**
   * 取景中心枢轴（保持 scale=1）。
   * 勿对 VRM 祖先做非 1 缩放——SpringBone 重力会失效（头发/裙子平摊）。
   * 屏幕身高用 camera.zoom 控制。
   */
  private scalePivot = new THREE.Group();
  private vrm: VRM | null = null;
  private clock = new THREE.Clock();
  private travelMoving = false;
  private displayHeading = 0;
  private animationId: number | null = null;
  private basePosition = new THREE.Vector3();
  private bodyPicker = new VrmBodyPicker();
  private animationPlayer = new VrmAnimationPlayer();
  private framing: VrmFramingState | null = null;
  private facingOffsetY = 0;
  private travelKind: LocomotionKind = "walk";
  private loadGeneration = 0;
  /** 角色 footprint 左上角（窗内 CSS 像素） */
  private screenPos: ScreenPointPx = { x: 0, y: 0 };
  private canvasSize = { width: CHARACTER_FOOTPRINT_WIDTH, height: CHARACTER_FOOTPRINT_HEIGHT };
  private canvasRect: DOMRect | null = null;
  private screenPosDirty = true;
  private projectTmp = new THREE.Vector3();
  private headBox = new THREE.Box3();
  private hitBox = new THREE.Box3();
  private hitCorner = new THREE.Vector3();
  private hitScreen = { left: 0, right: 0, top: 0, bottom: 0 };
  private hitBoundsAtMs = 0;
  private bubbleTracking = false;
  /** VRMA blob: URL 回收（Cache API + createObjectURL） */
  private motionUrlRevokes: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.displayRoot.add(this.scalePivot);
    this.scene.add(this.displayRoot);

    const aspect =
      canvas.clientWidth / canvas.clientHeight ||
      CHARACTER_FOOTPRINT_WIDTH / CHARACTER_FOOTPRINT_HEIGHT;
    const halfH = 1.2;
    this.camera = new THREE.OrthographicCamera(
      -halfH * aspect,
      halfH * aspect,
      halfH,
      -halfH,
      0.1,
      100,
    );
    this.camera.position.set(0, 1.2, 10);
    this.camera.lookAt(0, 1.2, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.refreshCanvasRect();

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(1, 2, 2);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.35));
  }

  async load(source: string, motionConfig: MotionBindConfig): Promise<void> {
    const generation = ++this.loadGeneration;
    this.stopRenderLoop();
    this.clearCharacterFromScene();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(source);
    if (generation !== this.loadGeneration) return;

    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) {
      throw new Error("not a VRM model");
    }

    VRMUtils.rotateVRM0(vrm);
    this.facingOffsetY = resolveFacingOffsetY(vrm.meta?.metaVersion);
    sanitizeMtoonOutlinesForOrtho(getVrmScene(vrm));
    this.scalePivot.add(getVrmScene(vrm));
    this.vrm = vrm;
    this.framing = null;
    this.refitCamera(vrm, true);
    this.screenPosDirty = true;
    this.applyScreenPosition();
    this.setEmotion("neutral", 1);
    attachLookAtQuaternionProxy(vrm);

    await this.animationPlayer.bind(vrm, (path) => this.resolveMotionUrl(path), motionConfig);
    if (generation !== this.loadGeneration) {
      this.clearCharacterFromScene();
      return;
    }
    this.syncTravelAnimation();
    this.startRenderLoop();
  }

  async reloadAnimations(motionConfig: MotionBindConfig): Promise<void> {
    if (!this.vrm) return;
    this.revokeMotionUrls();
    await this.animationPlayer.reload(
      this.vrm,
      (path) => this.resolveMotionUrl(path),
      motionConfig,
    );
    this.syncTravelAnimation();
  }

  private syncTravelAnimation(): void {
    if (!this.travelMoving || !this.vrm) return;
    if (this.useVrmaLocomotion(this.travelKind)) {
      this.animationPlayer.playLocomotion(this.travelKind);
    }
  }

  playSlot(slot: MotionSlotId, motionId?: string): void {
    this.animationPlayer.playSlot(slot, motionId);
  }

  private async resolveMotionUrl(path: string): Promise<string> {
    const cached = await loadCachedModelSource(path);
    this.motionUrlRevokes.push(cached.revoke);
    return cached.url;
  }

  private revokeMotionUrls(): void {
    for (const revoke of this.motionUrlRevokes) revoke();
    this.motionUrlRevokes = [];
  }

  private useVrmaLocomotion(kind: LocomotionKind): boolean {
    return this.animationPlayer.hasLocomotionClip(kind);
  }

  setTravelState(state: TravelState): void {
    const wasMoving = this.travelMoving;
    this.travelMoving = state.moving && state.speedPxPerSec >= MIN_WALK_SPEED_PX;
    this.travelKind = state.kind;

    if (this.travelMoving) {
      this.displayHeading = state.heading;
    }

    if (this.vrm && wasMoving !== this.travelMoving) {
      if (this.travelMoving) {
        if (this.useVrmaLocomotion(state.kind)) {
          this.animationPlayer.playLocomotion(state.kind);
        }
        this.refitCamera(this.vrm, false, true);
      } else {
        this.animationPlayer.resumeFromLocomotion();
        this.refitCamera(this.vrm, false, false);
      }
      this.screenPosDirty = true;
      this.applyScreenPosition();
    } else if (this.travelMoving && this.vrm && this.useVrmaLocomotion(state.kind)) {
      this.animationPlayer.playLocomotion(state.kind);
    }
  }

  resumeIdleMotion(): void {
    this.animationPlayer.resumeFromLocomotion();
  }

  setScreenPosition(x: number, y: number): void {
    this.screenPos = { x: Math.round(x), y: Math.round(y) };
    this.screenPosDirty = true;
    this.applyScreenPosition();
  }

  getScreenPosition(): ScreenPointPx {
    return { ...this.screenPos };
  }

  setBubbleTracking(enabled: boolean): void {
    this.bubbleTracking = enabled;
  }

  /**
   * 气泡锚点：头骨子树 AABB 最高点（含发饰/头发）投影，再上抬边距。
   */
  getHeadScreenPosition(): ScreenPointPx | null {
    if (!this.vrm || !this.bubbleTracking) return null;
    const rect = this.ensureCanvasRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const head = getVrmNormalizedBoneNode(this.vrm, "head");
    if (head) {
      this.headBox.setFromObject(head);
      if (this.headBox.isEmpty()) {
        head.getWorldPosition(this.projectTmp);
      } else {
        this.projectTmp.set(
          (this.headBox.min.x + this.headBox.max.x) / 2,
          this.headBox.max.y,
          (this.headBox.min.z + this.headBox.max.z) / 2,
        );
      }
    } else {
      this.hitBox.setFromObject(this.scalePivot);
      this.projectTmp.set(
        (this.hitBox.min.x + this.hitBox.max.x) / 2,
        this.hitBox.max.y,
        (this.hitBox.min.z + this.hitBox.max.z) / 2,
      );
    }

    this.projectTmp.project(this.camera);
    return {
      x: rect.left + (this.projectTmp.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-this.projectTmp.y * 0.5 + 0.5) * rect.height - BUBBLE_ABOVE_TOP_PX,
    };
  }

  private refreshCanvasRect(): void {
    this.canvasRect = this.renderer.domElement.getBoundingClientRect();
  }

  private ensureCanvasRect(): DOMRect {
    if (!this.canvasRect || this.canvasRect.width <= 0) {
      this.refreshCanvasRect();
    }
    return this.canvasRect ?? this.renderer.domElement.getBoundingClientRect();
  }

  private refitCamera(vrm: VRM, reposition: boolean, traveling = false): void {
    const scene = getVrmScene(vrm);
    if (reposition || !this.framing) {
      // 暂时放到世界原点算 grounding，再挂回 scalePivot
      if (scene.parent !== this.scene) {
        this.scene.add(scene);
      }
      const { basePosition, framing } = computeVrmFraming(vrm);
      this.framing = framing;
      this.basePosition.copy(basePosition);

      this.scalePivot.position.set(framing.centerX, framing.lookAtY, 0);
      this.scalePivot.add(scene);
      scene.position.set(
        basePosition.x - framing.centerX,
        basePosition.y - framing.lookAtY,
        basePosition.z,
      );
    }
    if (this.framing) {
      // 正交近距取景；全屏靠 camera.zoom 缩到 footprint 高（不缩放 VRM、无角落透视）
      applyVrmCameraFraming(this.camera, this.framing, {
        paddingX: 1.06,
        topHeadroomRatio: traveling ? 0.32 : 0.36,
        bottomMarginRatio: traveling ? 0.14 : 0.03,
        fitWidth: false,
      });
      this.screenPosDirty = true;
    }
  }

  private applyScreenPosition(): void {
    if (!this.vrm || !this.framing || !this.screenPosDirty) return;

    const rect = this.ensureCanvasRect();
    const canvasW = rect.width > 0 ? rect.width : this.canvasSize.width;
    const canvasH = rect.height > 0 ? rect.height : this.canvasSize.height;
    if (canvasW <= 0 || canvasH <= 0) return;

    const halfH = this.framing.viewHalfH;
    const aspect = canvasW / canvasH;
    // zoom<1 → 视锥变大 → 角色在屏上变小；模型世界尺度保持 1
    const zoom = CHARACTER_FOOTPRINT_HEIGHT / canvasH;
    this.scalePivot.scale.set(1, 1, 1);
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.zoom = zoom;
    this.camera.position.set(this.framing.centerX, this.framing.lookAtY, 10);
    this.camera.lookAt(this.framing.centerX, this.framing.lookAtY, 0);
    this.camera.updateProjectionMatrix();

    const targetCx = this.screenPos.x + CHARACTER_FOOTPRINT_WIDTH / 2;
    const targetCy = this.screenPos.y + CHARACTER_FOOTPRINT_HEIGHT / 2;
    const localCx = targetCx - rect.left;
    const localCy = targetCy - rect.top;

    const visibleHalfH = halfH / zoom;
    const visibleHalfW = visibleHalfH * aspect;

    const ndcX = (localCx - canvasW / 2) / (canvasW / 2);
    const ndcY = -((localCy - canvasH / 2) / (canvasH / 2));

    this.displayRoot.position.set(ndcX * visibleHalfW, ndcY * visibleHalfH, 0);
    this.screenPosDirty = false;
    this.hitBoundsAtMs = 0;
  }

  setEmotion(emotion: EmotionKind, weight = 1): void {
    if (!this.vrm?.expressionManager) return;

    for (const key of Object.values(VRM_EMOTION_MAP)) {
      this.vrm.expressionManager.setValue(key, 0);
    }

    const preset = VRM_EMOTION_MAP[emotion];
    if (preset && this.vrm.expressionManager.getExpression(preset)) {
      this.vrm.expressionManager.setValue(preset, weight);
    }
  }

  playMotion(file: string): void {
    this.animationPlayer.playMotion(file);
  }

  playZoneMotion(zone: BodyZone): void {
    this.animationPlayer.playZoneMotion(zone);
  }

  hasMotionClips(): boolean {
    return this.animationPlayer.hasClips();
  }

  private applyPose(delta: number): void {
    if (!this.vrm) return;

    if (!this.travelMoving) {
      this.displayHeading = THREE.MathUtils.lerp(this.displayHeading, 0, 1 - Math.exp(-10 * delta));
      if (Math.abs(this.displayHeading) < 0.002) {
        this.displayHeading = 0;
      }
    }

    getVrmScene(this.vrm).rotation.y = this.facingOffsetY + this.displayHeading;
    this.applyScreenPosition();

    if (
      this.travelMoving &&
      !this.animationPlayer.isPlayingOneShot() &&
      this.useVrmaLocomotion(this.travelKind)
    ) {
      this.animationPlayer.playLocomotion(this.travelKind);
    }

    this.animationPlayer.update(delta);
  }

  private refreshHitScreenBoundsIfNeeded(): boolean {
    if (!this.vrm) return false;
    const now = performance.now();
    if (now - this.hitBoundsAtMs < HIT_BOUNDS_TTL_MS && this.hitBoundsAtMs > 0) {
      return true;
    }
    this.hitBoundsAtMs = now;
    this.hitBox.setFromObject(this.displayRoot);
    if (this.hitBox.isEmpty()) return false;

    const rect = this.ensureCanvasRect();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const { min, max } = this.hitBox;
    for (let i = 0; i < 8; i++) {
      this.hitCorner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
      this.hitCorner.project(this.camera);
      const sx = rect.left + (this.hitCorner.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-this.hitCorner.y * 0.5 + 0.5) * rect.height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    this.hitScreen.left = minX - HIT_SCREEN_PAD_PX;
    this.hitScreen.right = maxX + HIT_SCREEN_PAD_PX;
    this.hitScreen.top = minY - HIT_SCREEN_PAD_PX;
    this.hitScreen.bottom = maxY + HIT_SCREEN_PAD_PX;
    return true;
  }

  /** click-through：只用屏幕 AABB，避免每 50ms mesh 射线（悬浮卡顿主因） */
  hitTest(screenX: number, screenY: number): boolean {
    if (!this.vrm) return false;
    if (!this.refreshHitScreenBoundsIfNeeded()) return false;
    return (
      screenX >= this.hitScreen.left &&
      screenX <= this.hitScreen.right &&
      screenY >= this.hitScreen.top &&
      screenY <= this.hitScreen.bottom
    );
  }

  pickBodyZone(screenX: number, screenY: number): BodyZone | null {
    if (!this.vrm) return null;
    return this.bodyPicker.pickBodyZone(
      this.vrm,
      this.camera,
      this.renderer.domElement,
      screenX,
      screenY,
      this.ensureCanvasRect(),
    );
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.canvasSize = { width, height };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.refreshCanvasRect();
    this.screenPosDirty = true;
    this.hitBoundsAtMs = 0;
    if (this.vrm) {
      this.refitCamera(this.vrm, false);
      this.applyScreenPosition();
    }
  }

  dispose(): void {
    this.loadGeneration += 1;
    this.stopRenderLoop();
    this.clearCharacterFromScene();
    this.framing = null;
    this.renderer.dispose();
  }

  /** 切换模型前清场并刷透明帧，避免下载失败时残留旧角色 */
  beginModelSwitch(): void {
    this.loadGeneration += 1;
    this.stopRenderLoop();
    this.clearCharacterFromScene();
    this.framing = null;
    this.travelMoving = false;
    this.travelKind = "walk";
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
  }

  /** @internal 单测：切模后 travel 是否已停 */
  getTravelMovingForTest(): boolean {
    return this.travelMoving;
  }

  private stopRenderLoop(): void {
    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private clearCharacterFromScene(): void {
    this.animationPlayer.dispose();
    this.revokeMotionUrls();
    if (this.vrm) {
      const scene = getVrmScene(this.vrm);
      this.scalePivot.remove(scene);
      this.scene.remove(scene);
      VRMUtils.deepDispose(scene);
      this.vrm = null;
    }
    this.scalePivot.scale.set(1, 1, 1);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
  }

  private startRenderLoop(): void {
    this.stopRenderLoop();
    const tick = (): void => {
      this.animationId = requestAnimationFrame(tick);
      const delta = this.clock.getDelta();
      if (this.vrm) {
        this.applyPose(delta);
        this.vrm.update(delta);
      }
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }
}

let sharedBackend: VrmBackend | null = null;
let sharedBackendCanvas: HTMLCanvasElement | null = null;

export function getVrmBackend(canvas: HTMLCanvasElement): VrmBackend {
  if (sharedBackend && sharedBackendCanvas !== canvas) {
    sharedBackend.dispose();
    sharedBackend = null;
    sharedBackendCanvas = null;
  }
  if (!sharedBackend) {
    sharedBackend = new VrmBackend(canvas);
    sharedBackendCanvas = canvas;
  }
  return sharedBackend;
}

export function disposeVrmBackend(): void {
  sharedBackend?.dispose();
  sharedBackend = null;
  sharedBackendCanvas = null;
}

export function setVrmBackendForTest(backend: VrmBackend | null): void {
  sharedBackend = backend;
}
