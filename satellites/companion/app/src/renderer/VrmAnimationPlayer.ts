import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";
import type { VRM } from "@pixiv/three-vrm";
import { motionManifest, type MotionManifest } from "@shared/motion-manifest.ts";
import { companionDebug } from "@/lib/companion-debug.ts";
import type { LocomotionSlot } from "@/lib/api.ts";

const manifest = motionManifest;

export type MotionManifestView = MotionManifest;

export function getMotionManifest(): MotionManifestView {
  return manifest;
}

export class VrmAnimationPlayer {
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private idleAction: THREE.AnimationAction | null = null;
  private oneShotAction: THREE.AnimationAction | null = null;
  private locomotionAction: THREE.AnimationAction | null = null;
  private activeLocomotionFile: string | null = null;
  private oneShotPlaying = false;
  private loaded = false;
  private locomotionFiles: Partial<Record<LocomotionSlot, string>> = {};

  async bind(
    vrm: VRM,
    resolveUrl: (path: string) => Promise<string>,
    locomotionOverrides?: Partial<Record<LocomotionSlot, string | null>>,
  ): Promise<void> {
    this.dispose();
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);

    this.locomotionFiles = {};
    if (locomotionOverrides) {
      for (const slot of ["walk", "climb"] as const) {
        const file = locomotionOverrides[slot];
        if (file) this.locomotionFiles[slot] = file;
      }
    }

    const files = new Set<string>([manifest.idle, ...Object.values(manifest.zones)]);
    for (const file of Object.values(this.locomotionFiles)) {
      files.add(file);
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    let anyLoaded = false;
    for (const file of files) {
      if (this.clips.has(file)) continue;
      try {
        const url = await resolveUrl(`${manifest.baseUrl}/${file}`);
        const gltf = await loader.loadAsync(url);
        const animations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
        const vrma = animations?.[0];
        if (!vrma) continue;
        const clip = createVRMAnimationClip(vrma, vrm);
        this.clips.set(file, clip);
        anyLoaded = true;
      } catch (e) {
        console.warn(`[companion] VRMA 加载失败: ${file}`, e);
      }
    }

    this.loaded = anyLoaded;
    companionDebug("VRMA bind 完成", {
      loaded: this.loaded,
      clipCount: this.clips.size,
      files: [...this.clips.keys()],
      locomotion: this.locomotionFiles,
    });
    if (this.loaded) {
      this.playIdle();
    }
  }

  hasClips(): boolean {
    return this.loaded && this.clips.size > 0;
  }

  hasLocomotionClip(slot: LocomotionSlot): boolean {
    const file = this.locomotionFiles[slot];
    return Boolean(file && this.clips.has(file));
  }

  isPlayingOneShot(): boolean {
    return this.oneShotPlaying;
  }

  isPlayingLocomotion(): boolean {
    return this.locomotionAction !== null;
  }

  playIdle(): void {
    if (!this.mixer || !this.vrm) return;
    const clip = this.clips.get(manifest.idle);
    if (!clip) return;

    this.stopLocomotion();
    this.stopOneShot();
    if (this.idleAction) {
      this.idleAction.reset().fadeIn(0.2).play();
      return;
    }

    this.idleAction = this.mixer.clipAction(clip);
    this.idleAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
    this.idleAction.play();
  }

  playMotion(file: string): void {
    if (!this.mixer || !this.vrm) return;
    const clip = this.clips.get(file);
    if (!clip) {
      companionDebug("playMotion 无 clip", { file, available: [...this.clips.keys()] });
      return;
    }

    this.stopLocomotion();
    this.stopOneShot();

    if (this.idleAction) {
      this.idleAction.fadeOut(0.15);
    }

    this.oneShotAction = this.mixer.clipAction(clip);
    this.oneShotAction.reset();
    this.oneShotAction.setLoop(THREE.LoopOnce, 1);
    this.oneShotAction.clampWhenFinished = true;
    this.oneShotAction.fadeIn(0.15).play();
    this.oneShotPlaying = true;

    const onFinished = (event: { action: THREE.AnimationAction }): void => {
      if (event.action !== this.oneShotAction) return;
      this.mixer?.removeEventListener("finished", onFinished);
      this.oneShotPlaying = false;
      this.oneShotAction = null;
      this.playIdle();
    };
    this.mixer.addEventListener("finished", onFinished);
  }

  /** 巡逻位移循环：walk / climb */
  playLocomotion(slot: LocomotionSlot): void {
    if (!this.mixer || !this.vrm) return;
    const file = this.locomotionFiles[slot];
    if (!file) return;

    const clip = this.clips.get(file);
    if (!clip) return;

    if (this.activeLocomotionFile === file && this.locomotionAction?.isRunning()) {
      return;
    }

    this.stopOneShot();
    if (this.idleAction) {
      this.idleAction.fadeOut(0.12);
      this.idleAction = null;
    }
    if (this.locomotionAction) {
      this.locomotionAction.fadeOut(0.12);
    }

    this.locomotionAction = this.mixer.clipAction(clip);
    this.locomotionAction.reset();
    this.locomotionAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
    this.locomotionAction.fadeIn(0.12).play();
    this.activeLocomotionFile = file;
  }

  pauseForLocomotion(): void {
    if (this.idleAction) {
      this.idleAction.stop();
      this.idleAction = null;
    }
    this.stopOneShot();
    this.stopLocomotion();
    this.mixer?.stopAllAction();
  }

  resumeFromLocomotion(): void {
    this.stopLocomotion();
    if (this.hasClips() && !this.oneShotPlaying) {
      this.playIdle();
    }
  }

  update(delta: number): void {
    this.mixer?.update(delta);
  }

  dispose(): void {
    this.stopOneShot();
    this.stopLocomotion();
    if (this.idleAction) {
      this.idleAction.stop();
      this.idleAction = null;
    }
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.vrm = null;
    this.clips.clear();
    this.loaded = false;
    this.oneShotPlaying = false;
    this.locomotionFiles = {};
  }

  private stopLocomotion(): void {
    if (this.locomotionAction) {
      this.locomotionAction.stop();
      this.locomotionAction = null;
    }
    this.activeLocomotionFile = null;
  }

  private stopOneShot(): void {
    if (this.oneShotAction) {
      this.oneShotAction.stop();
      this.oneShotAction = null;
    }
    this.oneShotPlaying = false;
  }
}

export function motionForZone(zone: string): string | undefined {
  return manifest.zones[zone];
}
