import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";
import type { VRM } from "@pixiv/three-vrm";
import { motionManifest } from "@shared/motion-manifest.ts";
import { resolveMotionForSlot } from "@shared/core/motion-slot-resolve.ts";
import type {
  MotionLibraryEntry,
  MotionSlotId,
  MotionSlotsConfig,
} from "@shared/companion-schema.ts";
import { companionDebug } from "@/lib/companion-debug.ts";

const manifest = motionManifest;

export type MotionBindConfig = {
  library: MotionLibraryEntry[];
  slots: MotionSlotsConfig;
};

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
  private motionConfig: MotionBindConfig = { library: [], slots: {} as MotionSlotsConfig };

  async bind(
    vrm: VRM,
    resolveUrl: (path: string) => Promise<string>,
    motionConfig: MotionBindConfig,
  ): Promise<void> {
    this.disposeMixerOnly();
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.motionConfig = motionConfig;

    const files = this.collectFiles(motionConfig);
    await this.loadClips(vrm, resolveUrl, files);
    if (this.loaded) {
      this.playIdle();
    }
  }

  async reload(
    vrm: VRM,
    resolveUrl: (path: string) => Promise<string>,
    motionConfig: MotionBindConfig,
  ): Promise<void> {
    await this.bind(vrm, resolveUrl, motionConfig);
  }

  private collectFiles(motionConfig: MotionBindConfig): Set<string> {
    const files = new Set<string>();
    for (const entry of motionConfig.library) {
      files.add(entry.file);
    }
    for (const ids of Object.values(motionConfig.slots)) {
      for (const ref of ids) {
        const entry = motionConfig.library.find((e) => e.id === ref);
        if (entry) files.add(entry.file);
        else if (ref.endsWith(".vrma")) files.add(ref);
      }
    }
    return files;
  }

  private async loadClips(
    vrm: VRM,
    resolveUrl: (path: string) => Promise<string>,
    files: Set<string>,
  ): Promise<void> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    let anyLoaded = false;
    for (const file of files) {
      if (this.clips.has(file)) {
        anyLoaded = true;
        continue;
      }
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
    });
  }

  hasClips(): boolean {
    return this.loaded && this.clips.size > 0;
  }

  hasSlotMotion(slot: MotionSlotId): boolean {
    const resolved = resolveMotionForSlot(slot, this.motionConfig.slots, this.motionConfig.library);
    return Boolean(resolved?.file && this.clips.has(resolved.file));
  }

  hasLocomotionClip(slot: "walk" | "climb"): boolean {
    return this.hasSlotMotion(slot);
  }

  isPlayingOneShot(): boolean {
    return this.oneShotPlaying;
  }

  playIdle(): void {
    const resolved = resolveMotionForSlot(
      "idle",
      this.motionConfig.slots,
      this.motionConfig.library,
    );
    if (resolved?.file) {
      this.playMotionFile(resolved.file, true);
    }
  }

  playSlot(slot: MotionSlotId, motionId?: string): void {
    const resolved = resolveMotionForSlot(
      slot,
      this.motionConfig.slots,
      this.motionConfig.library,
      {
        motionId,
      },
    );
    if (!resolved?.file) {
      companionDebug("playSlot 无解析结果", { slot, motionId });
      return;
    }
    const loop = slot === "idle" || slot === "walk" || slot === "climb" || slot === "rest";
    this.playMotionFile(resolved.file, loop);
  }

  /** 点击身体任意部位：从 in_place 槽位随机播放；槽位为空则不播 */
  playZoneMotion(_zone: string): void {
    const resolved = resolveMotionForSlot(
      "in_place",
      this.motionConfig.slots,
      this.motionConfig.library,
    );
    if (resolved?.file) {
      this.playMotionFile(resolved.file, false);
    } else {
      companionDebug("playZoneMotion 无 in_place 动作", {});
    }
  }

  playMotion(file: string): void {
    this.playMotionFile(file, false);
  }

  private playMotionFile(file: string, loop: boolean): void {
    if (!this.mixer || !this.vrm) return;
    const clip = this.clips.get(file);
    if (!clip) {
      companionDebug("playMotion 无 clip", { file, available: [...this.clips.keys()] });
      return;
    }

    if (loop) {
      this.stopLocomotion();
      this.stopOneShot();
      if (this.idleAction) this.idleAction.fadeOut(0.15);
      this.idleAction = this.mixer.clipAction(clip);
      this.idleAction.reset();
      this.idleAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
      this.idleAction.fadeIn(0.15).play();
      this.oneShotPlaying = false;
      return;
    }

    this.stopLocomotion();
    this.stopOneShot();
    if (this.idleAction) this.idleAction.fadeOut(0.15);

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

  playLocomotion(slot: "walk" | "climb"): void {
    if (!this.mixer || !this.vrm) return;
    const resolved = resolveMotionForSlot(slot, this.motionConfig.slots, this.motionConfig.library);
    const file = resolved?.file;
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
    if (this.locomotionAction) this.locomotionAction.fadeOut(0.12);

    this.locomotionAction = this.mixer.clipAction(clip);
    this.locomotionAction.reset();
    this.locomotionAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
    this.locomotionAction.fadeIn(0.12).play();
    this.activeLocomotionFile = file;
  }

  resumeFromLocomotion(): void {
    this.stopLocomotion();
    if (!this.oneShotPlaying) {
      this.playIdle();
    }
  }

  update(delta: number): void {
    this.mixer?.update(delta);
  }

  dispose(): void {
    this.disposeMixerOnly();
    this.clips.clear();
    this.loaded = false;
    this.vrm = null;
  }

  private disposeMixerOnly(): void {
    this.stopOneShot();
    this.stopLocomotion();
    if (this.idleAction) {
      this.idleAction.stop();
      this.idleAction = null;
    }
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.oneShotPlaying = false;
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
