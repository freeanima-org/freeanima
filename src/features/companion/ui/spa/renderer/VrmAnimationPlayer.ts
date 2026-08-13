import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createVrmAnimationClip,
  firstVrmAnimation,
  registerVrmAnimationLoader,
} from "./vrm-animation-access.ts";
import type { VRM } from "@pixiv/three-vrm";
import { getVrmScene } from "./vrm-three-access.ts";
import { motionManifest } from "@freeanima/features/companion/shared/motion-manifest.ts";
import {
  resolveLocomotionMotion,
  resolveMotionForSlot,
} from "@freeanima/features/companion/shared/core/motion-slot-resolve.ts";
import type {
  MotionLibraryEntry,
  MotionSlotId,
  MotionSlotsConfig,
} from "@freeanima/features/companion/shared/companion-schema.ts";
import { companionDebug } from "@freeanima/features/companion/ui/spa/lib/companion-debug.ts";

const manifest = motionManifest;
const LOOP_FADE_SEC = 0.15;
const LOCO_FADE_SEC = 0.12;
const ONE_SHOT_FADE_SEC = 0.15;

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
  private activeLocomotionSlot: "walk" | "climb" | null = null;
  private oneShotPlaying = false;
  private loaded = false;
  private motionConfig: MotionBindConfig = { library: [], slots: {} as MotionSlotsConfig };

  async bind(
    vrm: VRM,
    resolveUrl: (path: string) => Promise<string>,
    motionConfig: MotionBindConfig,
  ): Promise<void> {
    const outgoing = this.currentPoseAction();
    const resumeLocomotion = this.activeLocomotionSlot;
    const resumeLocomotionRunning = this.locomotionAction?.isRunning() ?? false;

    const files = this.collectFiles(motionConfig);
    const nextClips = new Map<string, THREE.AnimationClip>();
    await this.loadClips(vrm, resolveUrl, files, nextClips);

    if (nextClips.size === 0) {
      this.loaded = false;
      companionDebug("VRMA bind 无可用 clip", { files: [...files] });
      return;
    }

    if (!this.mixer || this.vrm !== vrm) {
      this.disposeMixerOnly();
      this.vrm = vrm;
      this.mixer = new THREE.AnimationMixer(getVrmScene(vrm));
    }

    this.clips = nextClips;
    this.motionConfig = motionConfig;
    this.loaded = true;
    this.clearActionRefs();

    companionDebug("VRMA bind 完成", {
      loaded: this.loaded,
      clipCount: this.clips.size,
      files: [...this.clips.keys()],
      hotReload: Boolean(outgoing),
    });

    if (resumeLocomotionRunning && resumeLocomotion) {
      this.playLocomotion(resumeLocomotion, outgoing);
      return;
    }
    this.playIdle(outgoing);
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
      files.add(`/motions/${entry.object_file_id}.vrma`);
    }
    for (const ids of Object.values(motionConfig.slots)) {
      for (const ref of ids) {
        files.add(`/motions/${ref}.vrma`);
      }
    }
    for (const slot of ["walk", "climb"] as const) {
      const resolved = resolveLocomotionMotion(slot, motionConfig.slots, motionConfig.library);
      if (resolved?.file) {
        files.add(resolved.file.startsWith("/") ? resolved.file : `/motions/${resolved.file}`);
      }
    }
    return files;
  }

  private async loadClips(
    vrm: VRM,
    resolveUrl: (path: string) => Promise<string>,
    files: Set<string>,
    target: Map<string, THREE.AnimationClip>,
  ): Promise<void> {
    const loader = new GLTFLoader();
    registerVrmAnimationLoader(loader);

    for (const file of files) {
      if (target.has(file)) continue;
      try {
        const path = file.startsWith("/") ? file : `${manifest.baseUrl}/${file}`;
        const url = await resolveUrl(path);
        const gltf = await loader.loadAsync(url);
        const vrma = firstVrmAnimation(gltf);
        if (vrma == null) continue;
        const clip = createVrmAnimationClip(vrma, vrm);
        target.set(file, clip);
      } catch (e) {
        console.warn(`[companion] VRMA 加载失败: ${file}`, e);
      }
    }
  }

  hasClips(): boolean {
    return this.loaded && this.clips.size > 0;
  }

  hasSlotMotion(slot: MotionSlotId): boolean {
    const resolved = resolveMotionForSlot(slot, this.motionConfig.slots, this.motionConfig.library);
    return Boolean(resolved?.file && this.clips.has(resolved.file));
  }

  hasLocomotionClip(slot: "walk" | "climb"): boolean {
    const resolved = resolveLocomotionMotion(
      slot,
      this.motionConfig.slots,
      this.motionConfig.library,
    );
    return Boolean(resolved?.file && this.clips.has(resolved.file));
  }

  isPlayingOneShot(): boolean {
    return this.oneShotPlaying;
  }

  playIdle(from?: THREE.AnimationAction | null): void {
    const resolved = resolveMotionForSlot(
      "idle",
      this.motionConfig.slots,
      this.motionConfig.library,
    );
    if (!resolved?.file) return;

    const clip = this.clips.get(resolved.file);
    if (
      !from &&
      !this.locomotionAction &&
      !this.oneShotPlaying &&
      this.idleAction?.isRunning() &&
      clip &&
      this.idleAction.getClip() === clip
    ) {
      return;
    }

    const outgoing = from ?? this.currentPoseAction();
    this.releaseLocomotionRef();
    this.releaseOneShotRef();
    this.idleAction = this.startLoopAction(resolved.file, outgoing, LOOP_FADE_SEC);
    this.oneShotPlaying = false;
  }

  playSlot(slot: MotionSlotId, motionId?: string): void {
    const resolved = resolveMotionForSlot(
      slot,
      this.motionConfig.slots,
      this.motionConfig.library,
      motionId !== undefined ? { motionId } : {},
    );
    if (!resolved?.file) {
      companionDebug("playSlot 无解析结果", { slot, motionId });
      return;
    }
    const loop = slot === "idle" || slot === "walk" || slot === "climb" || slot === "rest";
    this.playMotionFile(resolved.file, loop);
  }

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
    if (!this.clips.has(file)) {
      companionDebug("playMotion 无 clip", { file, available: [...this.clips.keys()] });
      return;
    }

    const outgoing = this.currentPoseAction();

    if (loop) {
      this.releaseLocomotionRef();
      this.releaseOneShotRef();
      this.idleAction = this.startLoopAction(file, outgoing, LOOP_FADE_SEC);
      this.oneShotPlaying = false;
      return;
    }

    this.releaseLocomotionRef();
    this.releaseOneShotRef();
    this.releaseIdleRef();

    this.oneShotAction = this.startOneShotAction(file, outgoing, ONE_SHOT_FADE_SEC);
    if (!this.oneShotAction) return;
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

  playLocomotion(slot: "walk" | "climb", from?: THREE.AnimationAction | null): void {
    if (!this.mixer || !this.vrm) return;
    const resolved = resolveLocomotionMotion(
      slot,
      this.motionConfig.slots,
      this.motionConfig.library,
    );
    const file = resolved?.file;
    if (!file || !this.clips.has(file)) {
      companionDebug("playLocomotion 无可用 clip", {
        slot,
        file,
        available: [...this.clips.keys()],
      });
      return;
    }

    if (this.activeLocomotionFile === file && this.locomotionAction?.isRunning()) {
      return;
    }

    this.releaseOneShotRef();
    this.releaseIdleRef();

    const outgoing = from ?? this.currentPoseAction();
    this.locomotionAction = this.startLoopAction(file, outgoing, LOCO_FADE_SEC);
    this.activeLocomotionFile = file;
    this.activeLocomotionSlot = slot;
  }

  resumeFromLocomotion(): void {
    if (this.oneShotPlaying) return;
    this.playIdle(this.locomotionAction ?? this.idleAction);
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
    this.clearActionRefs();
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.oneShotPlaying = false;
  }

  private clearActionRefs(): void {
    this.idleAction = null;
    this.oneShotAction = null;
    this.locomotionAction = null;
    this.activeLocomotionFile = null;
    this.activeLocomotionSlot = null;
    this.oneShotPlaying = false;
  }

  private currentPoseAction(): THREE.AnimationAction | null {
    if (this.oneShotAction?.isRunning()) return this.oneShotAction;
    if (this.locomotionAction?.isRunning()) return this.locomotionAction;
    if (this.idleAction?.isRunning()) return this.idleAction;
    return this.locomotionAction ?? this.idleAction ?? this.oneShotAction;
  }

  private startLoopAction(
    file: string,
    from: THREE.AnimationAction | null | undefined,
    fadeSec: number,
  ): THREE.AnimationAction | null {
    if (!this.mixer) return null;
    const clip = this.clips.get(file);
    if (!clip) return null;

    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
    this.crossfadeOrFadeIn(next, from, fadeSec);
    return next;
  }

  private startOneShotAction(
    file: string,
    from: THREE.AnimationAction | null | undefined,
    fadeSec: number,
  ): THREE.AnimationAction | null {
    if (!this.mixer) return null;
    const clip = this.clips.get(file);
    if (!clip) return null;

    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    this.crossfadeOrFadeIn(next, from, fadeSec);
    return next;
  }

  private crossfadeOrFadeIn(
    next: THREE.AnimationAction,
    from: THREE.AnimationAction | null | undefined,
    fadeSec: number,
  ): void {
    if (from && from !== next && (from.isRunning() || from.getEffectiveWeight() > 0)) {
      next.crossFadeFrom(from, fadeSec, false);
    } else {
      next.fadeIn(fadeSec);
    }
    next.play();
  }

  private releaseIdleRef(): void {
    this.idleAction = null;
  }

  private releaseLocomotionRef(): void {
    this.locomotionAction = null;
    this.activeLocomotionFile = null;
    this.activeLocomotionSlot = null;
  }

  private releaseOneShotRef(): void {
    this.oneShotAction = null;
    this.oneShotPlaying = false;
  }
}
