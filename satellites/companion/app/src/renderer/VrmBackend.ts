import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { type CharacterBackend, type EmotionKind, VRM_EMOTION_MAP } from "./CharacterBackend.ts";
import { VrmProceduralLocomotion } from "./VrmProceduralLocomotion.ts";
import {
  applyVrmCameraFraming,
  computeVrmFraming,
  type VrmFramingState,
} from "./VrmCameraFraming.ts";

/** 低于此速度视为站立（px/s） */
const MIN_WALK_SPEED_PX = 8;

export type TravelState = {
  moving: boolean;
  speedPxPerSec: number;
  heading: number;
};

export class VrmBackend implements CharacterBackend {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private vrm: VRM | null = null;
  private clock = new THREE.Clock();
  private currentEmotion: EmotionKind = "neutral";
  private talking = false;
  private travelMoving = false;
  private travelSpeedPxPerSec = 0;
  private displayHeading = 0;
  private animationId: number | null = null;
  private basePosition = new THREE.Vector3();
  private hitBox = new THREE.Box3();
  private hitSphere = new THREE.Sphere();
  private locomotion = new VrmProceduralLocomotion();
  private framing: VrmFramingState | null = null;

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

  async load(source: string): Promise<void> {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.scene.remove(this.vrm.scene);
      this.vrm = null;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(source);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) {
      throw new Error("not a VRM model");
    }

    VRMUtils.rotateVRM0(vrm);
    vrm.scene.rotation.y = Math.PI;
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.locomotion.reset(vrm);
    this.framing = null;
    this.refitCamera(vrm, true);
    this.setEmotion("neutral", 1);
    this.startLoop();
  }

  /** 位移状态：仅在 moving 且速度足够时播放走路骨骼 */
  setTravelState(state: TravelState): void {
    const wasMoving = this.travelMoving;
    this.travelMoving = state.moving && state.speedPxPerSec >= MIN_WALK_SPEED_PX;
    this.travelSpeedPxPerSec = this.travelMoving ? state.speedPxPerSec : 0;

    if (this.travelMoving) {
      this.displayHeading = state.heading;
    }

    if (this.vrm && wasMoving !== this.travelMoving) {
      this.locomotion.reset(this.vrm);
    }
  }

  private refitCamera(vrm: VRM, reposition: boolean): void {
    if (reposition || !this.framing) {
      this.locomotion.reset(vrm);
      const { basePosition, framing } = computeVrmFraming(vrm);
      this.framing = framing;
      this.basePosition.copy(basePosition);
      vrm.scene.position.copy(this.basePosition);
    }
    if (this.framing) {
      applyVrmCameraFraming(this.camera, this.framing, { paddingX: 1.06, paddingY: 1.16 });
    }
  }

  setEmotion(emotion: EmotionKind, weight = 1): void {
    this.currentEmotion = emotion;
    if (!this.vrm?.expressionManager) return;

    for (const key of Object.values(VRM_EMOTION_MAP)) {
      this.vrm.expressionManager.setValue(key, 0);
    }

    const preset = VRM_EMOTION_MAP[emotion];
    if (preset && this.vrm.expressionManager.getExpression(preset)) {
      this.vrm.expressionManager.setValue(preset, weight);
    }
  }

  playAction(action: string): void {
    if (action === "talk") {
      this.talking = true;
      this.setEmotion("talk", 0.6);
      return;
    }

    if (action === "idle") {
      this.talking = false;
      this.setEmotion(this.currentEmotion === "talk" ? "neutral" : this.currentEmotion, 1);
      return;
    }

    if (action === "walk") {
      // 走路由 setTravelState 驱动，忽略旧接口
      return;
    }
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

    this.vrm.scene.rotation.y = Math.PI + this.displayHeading;

    if (this.talking) {
      this.locomotion.applyIdle(this.vrm, delta);
      return;
    }

    if (this.travelMoving) {
      this.locomotion.applyWalk(this.vrm, delta, this.travelSpeedPxPerSec);
      return;
    }

    this.locomotion.applyIdle(this.vrm, delta);
  }

  hitTest(screenX: number, screenY: number): boolean {
    if (!this.vrm) return false;

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.hitBox.setFromObject(this.vrm.scene);
    this.hitBox.getBoundingSphere(this.hitSphere);

    const ndc = new THREE.Vector3(x, y, 0.5);
    ndc.unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    const dist = (this.hitSphere.center.y - this.camera.position.y) / dir.y;
    const point = this.camera.position.clone().add(dir.multiplyScalar(dist));

    const expanded = this.hitSphere.clone();
    expanded.radius *= 1.15;
    return expanded.containsPoint(point);
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
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.framing = null;
    this.renderer.dispose();
  }

  private startLoop(): void {
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

export function getVrmBackend(canvas: HTMLCanvasElement): VrmBackend {
  if (!sharedBackend) {
    sharedBackend = new VrmBackend(canvas);
  }
  return sharedBackend;
}

export function disposeVrmBackend(): void {
  sharedBackend?.dispose();
  sharedBackend = null;
}
