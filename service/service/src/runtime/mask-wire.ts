import { existsSync, readFileSync } from "node:fs";
import { MaskRegistry, resolveMaskByName, resolveMaskPresets } from "@freeanima/capabilities-mask";
import type {
  MaskRegistryLookup,
  ResolvedMask,
  SessionCapabilityMask,
} from "@freeanima/capabilities-mask";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { isSessionMeta, type SessionMetaMessage } from "@freeanima/engine-db/domain";
import { registerSessionToolMaskFilter } from "@freeanima/engine-conversation";
import { parseYaml, PATHS } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";
import { z } from "zod";
import { getServiceContext } from "../context.ts";

const credentialPermissionSchema = z.object({
  name: z.string(),
  read: z.enum(["allow", "deny"]).nullable(),
  write: z.enum(["allow", "deny"]).nullable(),
});

const maskYamlSchema = z.object({
  inherits: z.array(z.string()).default([]),
  allowed_tools: z.array(z.string()).default([]),
  denied_tools: z.array(z.string()).default([]),
  auto_skills: z.array(z.string()).default([]),
  credentials: z.array(credentialPermissionSchema).default([]),
});

const masksFileSchema = z.object({
  masks: z.record(z.string(), maskYamlSchema),
});

const SLEEP_MASK = {
  inherits: [] as string[],
  allowed_tools: [
    "memory_recall",
    "memory_semantic_search",
    "memory_semantic_create",
    "memory_semantic_update",
    "memory_semantic_deprecate",
    "memory_semantic_merge",
    "memory_limbic_create",
    "memory_autobiographical_create",
    "memory_autobiographical_deprecate",
  ],
  denied_tools: [] as string[],
  auto_skills: [] as string[],
  credentials: [] as [],
};

function registerBuiltinMasks(masks: MaskRegistry): void {
  masks.register("sleep", SLEEP_MASK);
}

function loadMasksFromYaml(masks: MaskRegistry): void {
  const path = PATHS.masksYaml;
  if (!existsSync(path)) return;
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(path, "utf-8"));
  } catch (e) {
    logComponent("mask").warn(`无法解析 ${path}: ${String(e)}`);
    return;
  }
  const parsed = masksFileSchema.safeParse(raw);
  if (!parsed.success) {
    logComponent("mask").warn(`masks.yaml 格式无效: ${parsed.error.message}`);
    return;
  }
  for (const [name, mask] of Object.entries(parsed.data.masks)) {
    if (masks.get(name)) {
      logComponent("mask").warn(`跳过 masks.yaml 中的 '${name}'：内置面具已存在`);
      continue;
    }
    try {
      masks.register(name, mask);
    } catch (e) {
      logComponent("mask").warn(`注册面具 '${name}' 失败: ${String(e)}`);
    }
  }
}

function catalogFromContext(): { masks: MaskRegistryLookup; toolSets: ToolSetRegistry } {
  const { masks, engine } = getServiceContext();
  return { masks, toolSets: engine.catalog.toolSets };
}

export function resolveSessionCapabilityMask(
  capabilityMask: SessionCapabilityMask | undefined,
): ResolvedMask | null {
  const presets = capabilityMask?.presets ?? [];
  if (!presets.length) return null;
  const { masks, toolSets } = catalogFromContext();
  return resolveMaskPresets(presets, masks, toolSets);
}

export function resolveSessionMaskFromMeta(
  meta: SessionMetaMessage | Record<string, never>,
): ResolvedMask | null {
  if (!isSessionMeta(meta)) return null;
  return resolveSessionCapabilityMask(meta.capability_mask);
}

export function resolveSleepMask(): ResolvedMask {
  const { masks, toolSets } = catalogFromContext();
  return resolveMaskByName("sleep", masks, toolSets);
}

export function filterToolNamesByMask(
  toolNames: readonly string[],
  resolved: ResolvedMask,
): string[] {
  const allowed = new Set(resolved.allowed_tools);
  return toolNames.filter((name) => allowed.has(name));
}

export function runtimeToolMaskFromResolved(
  resolved: ResolvedMask | null,
): { allowedTools: readonly string[] } | undefined {
  if (!resolved) return undefined;
  return { allowedTools: resolved.allowed_tools };
}

/** 启动时注册内置 / YAML 面具，并注入 session 工具过滤 */
export function initMaskSystem(masks: MaskRegistry): void {
  registerBuiltinMasks(masks);
  loadMasksFromYaml(masks);

  registerSessionToolMaskFilter((toolNames, meta) => {
    const resolved = resolveSessionMaskFromMeta(meta);
    if (!resolved) return toolNames;
    return filterToolNamesByMask(toolNames, resolved);
  });
}

export { checkTool, checkCredential } from "@freeanima/capabilities-mask";
