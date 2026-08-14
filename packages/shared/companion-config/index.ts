import { z } from "zod";

/** 桌面伴侣模块配置（runtime 段 `companion`）；以 object_file_id 为键，不含自有 id / path */
export const companionModelEntrySchema = z.object({
  name: z.string(),
  object_file_id: z.number().int().positive(),
  /** 越小越靠前 */
  sort: z.number().int(),
});

export const companionMotionEntrySchema = z.object({
  name: z.string(),
  object_file_id: z.number().int().positive(),
  sort: z.number().int(),
});

export const companionBehaviorSchema = z.object({
  patrol_enabled: z.boolean(),
  idle_patrol_delay_sec: z.number(),
  patrol_pause_sec: z.number(),
  patrol_speed_px: z.number(),
  double_click_patrol: z.boolean(),
  startup_walk_enabled: z.boolean(),
});

/** 槽位绑定：object_file_id 列表（非自有 motion id） */
export const companionMotionSlotsSchema = z.object({
  idle: z.array(z.number().int().positive()),
  rest: z.array(z.number().int().positive()),
  walk: z.array(z.number().int().positive()),
  climb: z.array(z.number().int().positive()),
  in_place: z.array(z.number().int().positive()),
});

export const companionConfigSchema = z.object({
  /** 当前模型；null = 未选 */
  active_object_file_id: z.number().int().positive().nullable(),
  models: z.array(companionModelEntrySchema),
  motion_library: z.array(companionMotionEntrySchema),
  motion_slots: companionMotionSlotsSchema,
  behavior: companionBehaviorSchema,
});

export type CompanionRuntimeConfig = z.infer<typeof companionConfigSchema>;
export type CompanionModelEntry = z.infer<typeof companionModelEntrySchema>;
export type CompanionMotionEntry = z.infer<typeof companionMotionEntrySchema>;

export const DEFAULT_COMPANION_BEHAVIOR = {
  patrol_enabled: true,
  idle_patrol_delay_sec: 180,
  patrol_pause_sec: 10,
  patrol_speed_px: 95,
  double_click_patrol: true,
  startup_walk_enabled: true,
} as const satisfies z.infer<typeof companionBehaviorSchema>;

export function emptyCompanionMotionSlots(): z.infer<typeof companionMotionSlotsSchema> {
  return { idle: [], rest: [], walk: [], climb: [], in_place: [] };
}

export function defaultCompanionRuntimeConfig(): CompanionRuntimeConfig {
  return {
    active_object_file_id: null,
    models: [],
    motion_library: [],
    motion_slots: emptyCompanionMotionSlots(),
    behavior: { ...DEFAULT_COMPANION_BEHAVIOR },
  };
}

export function nextCompanionSort(entries: ReadonlyArray<{ sort: number }>): number {
  let max = -1;
  for (const e of entries) {
    if (e.sort > max) max = e.sort;
  }
  return max + 1;
}

export function sortCompanionEntries<T extends { sort: number }>(entries: T[]): T[] {
  return [...entries].toSorted((a, b) => a.sort - b.sort || 0);
}

/** 本机缓存文件名（由 object_file_id 推导，非配置权威字段） */
export function companionModelCacheFileName(objectFileId: number): string {
  return `${objectFileId}.vrm`;
}

export function companionMotionCacheFileName(objectFileId: number): string {
  return `${objectFileId}.vrma`;
}

export function companionModelCachePath(objectFileId: number): string {
  return `/models/${companionModelCacheFileName(objectFileId)}`;
}

export function companionMotionCachePath(objectFileId: number): string {
  return `/motions/${companionMotionCacheFileName(objectFileId)}`;
}
