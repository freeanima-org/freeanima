import { existsSync, readFileSync } from "node:fs";
import { parseYaml } from "@freeanima/service-config";
import { z } from "zod";
import {
  defaultMaskRegistry,
  getMask,
  registerMask,
  resolveMaskByName,
  resolveMaskPresets,
  type ResolvedMask,
  type SessionCapabilityMask,
} from "@freeanima/capabilities-mask";
import { defaultToolSetRegistry } from "@freeanima/engine-tool";
import { isSessionMeta, type SessionMetaMessage } from "@freeanima/engine-db/domain";
import { registerSessionToolMaskFilter } from "@freeanima/engine-conversation";
import { PATHS } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

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
    "recall",
    "search_semantic_memory",
    "create_semantic_memory",
    "update_semantic_memory",
    "deprecate_semantic_memory",
    "create_limbic_memory",
    "create_autobiographical_memory",
    "deprecate_autobiographical_memory",
  ],
  denied_tools: [] as string[],
  auto_skills: [] as string[],
  credentials: [] as [],
};

function registerBuiltinMasks(): void {
  registerMask("sleep", SLEEP_MASK);
}

function loadMasksFromYaml(): void {
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
    if (getMask(name)) {
      logComponent("mask").warn(`跳过 masks.yaml 中的 '${name}'：内置面具已存在`);
      continue;
    }
    try {
      registerMask(name, mask);
    } catch (e) {
      logComponent("mask").warn(`注册面具 '${name}' 失败: ${String(e)}`);
    }
  }
}

export function resolveSessionCapabilityMask(
  capabilityMask: SessionCapabilityMask | undefined,
): ResolvedMask | null {
  const presets = capabilityMask?.presets ?? [];
  if (!presets.length) return null;
  return resolveMaskPresets(presets, defaultMaskRegistry, defaultToolSetRegistry);
}

export function resolveSessionMaskFromMeta(
  meta: SessionMetaMessage | Record<string, never>,
): ResolvedMask | null {
  if (!isSessionMeta(meta)) return null;
  return resolveSessionCapabilityMask(meta.capability_mask);
}

export function resolveSleepMask(): ResolvedMask {
  return resolveMaskByName("sleep", defaultMaskRegistry, defaultToolSetRegistry);
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
export function initMaskSystem(): void {
  registerBuiltinMasks();
  loadMasksFromYaml();

  registerSessionToolMaskFilter((toolNames, meta) => {
    const resolved = resolveSessionMaskFromMeta(meta);
    if (!resolved) return toolNames;
    return filterToolNamesByMask(toolNames, resolved);
  });
}

export { checkTool, getMask, listMasks, defaultMaskRegistry } from "@freeanima/capabilities-mask";
