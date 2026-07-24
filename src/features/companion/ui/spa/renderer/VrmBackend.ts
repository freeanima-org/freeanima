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
import { VrmBodyPicker } from "./VrmBodyPicker.ts";
import { VrmAnimationPlayer, type MotionBindConfig } from "./VrmAnimationPlayer.ts";
import { resolveCompanionAssetUrl } from "@freeanima/features/companion/ui/spa/lib/sidecar-asset-url.ts";
import { loadCompanionAssetBlobUrl } from "@freeanima/features/companion/ui/spa/lib/model-cache.ts";
import type { MotionSlotId } from "@freeanima/features/companion/shared/companion-schema.ts";
import { VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";

const LOOK_AT_PROXY_NAME = "lookAtQuaternionProxy";

function attachLookAtQuaternionProxy(vrm: VRM): void {
  if (!vrm.lookAt) return;
  if (vrm.scene.getObjectByName(LOOK_AT_PROXY_NAME)) return;
  const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
  (proxy as unknown as THREE.Object3D).name = LOOK_AT_PROXY_NAME;
  vrm.scene.add(proxy);
}

const MIN_WALK_SPEED_PX = 8;

export type LocomotionKind = "walk" | "climb";

export type TravelState = {
  moving: boolean;
  speedPxPerSec: number;
  heading: number;
  kind: LocomotionKind;
};

export class VrmBackend implements CharacterBackend {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private vrm: VRM | null = null;
  private clock = new THREE.Clock();
  private travelMoving = false;
  private displayHeading = 0;
  private animationId: number | null = null;
  private basePosition = new THREE.Vector3();
  private hitBox = new THREE.Box3();
  private hitSphere = new THREE.Sphere();
  private bodyPicker = new VrmBodyPicker();
  private animationPlayer = new VrmAnimationPlayer();
  private framing: VrmFramingState | null = null;
  private facingOffsetY = 0;
  private travelKind: LocomotionKind = "walk";
  private loadGeneration = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      30,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      20,
    );
    this.camera.position.set(0, 1.2, 2.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setClearColor(0x000000, 0);

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(1, 2, 2);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
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
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.framing = null;
    this.refitCamera(vrm, true);
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
    const remote = await resolveCompanionAssetUrl(path);
    const blob = await loadCompanionAssetBlobUrl(remote);
    // blob URL 由调用方生命周期管理较难；短生命周期动画片段由 GC 回收 revoke 可接受
    // （播放器会缓存 clip，不重复拉同一 file）
    return blob.url;
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
    } else if (this.travelMoving && this.vrm && this.useVrmaLocomotion(state.kind)) {
      this.animationPlayer.playLocomotion(state.kind);
    }
  }

  resumeIdleMotion(): void {
    this.animationPlayer.resumeFromLocomotion();
  }

  private refitCamera(vrm: VRM, reposition: boolean, traveling = false): void {
    if (reposition || !this.framing) {
      const { basePosition, framing } = computeVrmFraming(vrm);
      this.framing = framing;
      this.basePosition.copy(basePosition);
      vrm.scene.position.copy(this.basePosition);
    }
    if (this.framing) {
      applyVrmCameraFraming(this.camera, this.framing, {
        paddingX: 1.06,
        topHeadroomRatio: traveling ? 0.32 : 0.36,
        bottomMarginRatio: traveling ? 0.14 : 0.03,
      });
    }
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

    this.vrm.scene.position.copy(this.basePosition);

    if (!this.travelMoving) {
      this.displayHeading = THREE.MathUtils.lerp(this.displayHeading, 0, 1 - Math.exp(-10 * delta));
      if (Math.abs(this.displayHeading) < 0.002) {
        this.displayHeading = 0;
      }
    }

    this.vrm.scene.rotation.y = this.facingOffsetY + this.displayHeading;

    if (
      this.travelMoving &&
      !this.animationPlayer.isPlayingOneShot() &&
      this.useVrmaLocomotion(this.travelKind)
    ) {
      this.animationPlayer.playLocomotion(this.travelKind);
    }

    this.animationPlayer.update(delta);
  }

  hitTest(screenX: number, screenY: number): boolean {
    if (!this.vrm) return false;

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const marginX = rect.width * 0.08;
    const marginTop = rect.height * 0.04;
    const marginBottom = rect.height * 0.06;
    if (
      screenX < rect.left + marginX ||
      screenX > rect.right - marginX ||
      screenY < rect.top + marginTop ||
      screenY > rect.bottom - marginBottom
    ) {
      return false;
    }

    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.hitBox.setFromObject(this.vrm.scene);
    this.hitBox.getBoundingSphere(this.hitSphere);

    const ndc = new THREE.Vector3(x, y, 0.5);
    ndc.unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    if (Math.abs(dir.y) < 1e-4) {
      return true;
    }
    const dist = (this.hitSphere.center.y - this.camera.position.y) / dir.y;
    const point = this.camera.position.clone().add(dir.multiplyScalar(dist));

    const expanded = this.hitSphere.clone();
    expanded.radius *= 1.35;
    return expanded.containsPoint(point);
  }

  pickBodyZone(screenX: number, screenY: number): BodyZone | null {
    if (!this.vrm) return null;
    return this.bodyPicker.pickBodyZone(
      this.vrm,
      this.camera,
      this.renderer.domElement,
      screenX,
      screenY,
    );
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = width / height;
    this.renderer.setSize(width, height, false);
    if (this.vrm) {
      this.refitCamera(this.vrm, false);
    }
  }

  dispose(): void {
    this.loadGeneration += 1;
    this.stopRenderLoop();
    this.clearCharacterFromScene();
    this.framing = null;
    this.renderer.dispose();
  }

  private stopRenderLoop(): void {
    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private clearCharacterFromScene(): void {
    this.animationPlayer.dispose();
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    const extras = this.scene.children.filter((child) => !(child instanceof THREE.Light));
    for (const child of extras) {
      this.scene.remove(child);
      VRMUtils.deepDispose(child);
    }
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
