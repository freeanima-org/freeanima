import { z } from "zod";

/** 能力主/子场景：连接 + 模型 */
export const capabilityBindingSchema = z.object({
  connection: z.string().min(1),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type CapabilityBinding = z.infer<typeof capabilityBindingSchema>;

/** 草稿 / 未配完：允许空连接 */
export const capabilityBindingLooseSchema = z
  .object({
    connection: z.string().optional(),
    model: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type CapabilityBindingDraft = z.infer<typeof capabilityBindingLooseSchema>;

const optionalChild = capabilityBindingLooseSchema.nullable().optional();

/** 文本生成：主场景聊天 + 子场景（省略/null = 同 main） */
export const textGenerateConfigSchema = z
  .object({
    main: capabilityBindingLooseSchema.optional(),
    summary: optionalChild,
    reflect: optionalChild,
    goal_judge: optionalChild,
    skill_review: optionalChild,
  })
  .passthrough();

export type TextGenerateConfig = z.infer<typeof textGenerateConfigSchema>;

/** 音频生成：主场景文生声 + 朗读 / 实时 */
export const audioGenerateConfigSchema = z
  .object({
    main: capabilityBindingLooseSchema.optional(),
    tts: optionalChild,
    voice_realtime: optionalChild,
    asr: optionalChild,
  })
  .passthrough();

export type AudioGenerateConfig = z.infer<typeof audioGenerateConfigSchema>;

/** 仅主场景（图片 / 视频） */
export const mainOnlyGenerateConfigSchema = z
  .object({
    main: capabilityBindingLooseSchema.optional(),
  })
  .passthrough();

export type MainOnlyGenerateConfig = z.infer<typeof mainOnlyGenerateConfigSchema>;

export const TEXT_GENERATE_CHILD_KEYS = [
  "summary",
  "reflect",
  "goal_judge",
  "skill_review",
] as const;

export type TextGenerateChildKey = (typeof TEXT_GENERATE_CHILD_KEYS)[number];

export const AUDIO_GENERATE_CHILD_KEYS = ["tts", "voice_realtime", "asr"] as const;
export type AudioGenerateChildKey = (typeof AUDIO_GENERATE_CHILD_KEYS)[number];

export function bindingComplete(
  binding: CapabilityBindingDraft | null | undefined,
): binding is CapabilityBinding {
  return Boolean(binding?.connection?.trim() && binding.model?.trim());
}

/** 子场景省略/null → 回落 main */
export function resolveLayerBinding(
  section: { main?: CapabilityBindingDraft | undefined } | null | undefined,
  child?: CapabilityBindingDraft | null,
): CapabilityBinding | null {
  const picked = child == null ? section?.main : child;
  if (!bindingComplete(picked)) return null;
  return {
    connection: picked.connection.trim(),
    model: picked.model.trim(),
    ...(picked.params ? { params: picked.params } : {}),
  };
}
