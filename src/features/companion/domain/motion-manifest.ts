import type { LocomotionSlot } from "./types.ts";
import manifest from "./motion-manifest.json";

export type MotionManifest = {
  baseUrl: string;
  idle: string;
  zones: Record<string, string>;
  locomotion?: Partial<Record<LocomotionSlot, string>>;
};

export const motionManifest = manifest as MotionManifest;

/** idle + 分区动作（不含 locomotion 默认文件名；locomotion 按需导入） */
export function requiredMotionFiles(): readonly string[] {
  const names = new Set<string>([motionManifest.idle, ...Object.values(motionManifest.zones)]);
  return [...names];
}
