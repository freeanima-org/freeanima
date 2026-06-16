import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { type CharacterBackend, type EmotionKind, VRM_EMOTION_MAP } from "./CharacterBackend.ts";

export class VrmBackend implements CharacterBackend {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private vrm: VRM | null = null;
  private clock = new THREE.Clock();
  private currentEmotion: EmotionKind = "neutral";
  private walkPhase = 0;
  private isWalking = false;
  private animationId: number | null = null;
  private hitBox = new THREE.Box3();
  private hitSphere = new THREE.Sphere();

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
    vrm.scene.position.set(0, -0.8, 0);
    vrm.scene.rotation.y = Math.PI;
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.setEmotion("neutral", 1);
    this.startLoop();
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
    this.isWalking = action === "walk";
    if (action === "talk") {
      this.setEmotion("talk", 0.6);
    } else if (action === "idle") {
      this.setEmotion(this.currentEmotion === "talk" ? "neutral" : this.currentEmotion, 1);
    }
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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
    this.renderer.dispose();
  }

  private startLoop(): void {
    const tick = (): void => {
      this.animationId = requestAnimationFrame(tick);
      const delta = this.clock.getDelta();
      if (this.vrm) {
        if (this.isWalking) {
          this.walkPhase += delta * 6;
          this.vrm.scene.position.x = Math.sin(this.walkPhase) * 0.05;
          this.vrm.scene.rotation.y = Math.PI + Math.sin(this.walkPhase * 0.5) * 0.15;
        }
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
