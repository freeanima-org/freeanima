import { existsSync, readFileSync } from "node:fs";
import {
  MaskRegistry,
  resolveMaskByName,
  resolveMaskPresets,
} from "@freeanima/capabilities-tasks/mask";
import type {
  MaskRegistryLookup,
  ResolvedMask,
  ConversationCapabilityMask,
} from "@freeanima/capabilities-tasks/mask";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { isConversationMeta, type ConversationMetaMessage } from "@freeanima/core/db/domain";
import { parseYaml, PATHS } from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";
import { z } from "zod";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

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
    logComponent("mask").warn(`Failed to parse ${path}: ${String(e)}`);
    return;
  }
  const parsed = masksFileSchema.safeParse(raw);
  if (!parsed.success) {
    logComponent("mask").warn(`masks.yaml invalid format: ${parsed.error.message}`);
    return;
  }
  for (const [name, mask] of Object.entries(parsed.data.masks)) {
    if (masks.get(name)) {
      logComponent("mask").warn(`Skipping '${name}' in masks.yaml: built-in mask already exists`);
      continue;
    }
    try {
      masks.register(name, mask);
    } catch (e) {
      logComponent("mask").warn(`Failed to register mask '${name}': ${String(e)}`);
    }
  }
}

function catalogFromDeps(deps: FullRuntimeDeps): {
  masks: MaskRegistryLookup;
  toolSets: ToolSetRegistry;
} {
  return { masks: deps.masks, toolSets: deps.engine.catalog.toolSets };
}

export function resolveConversationCapabilityMask(
  deps: FullRuntimeDeps,
  capabilityMask: ConversationCapabilityMask | undefined,
): ResolvedMask | null {
  const presets = capabilityMask?.presets ?? [];
  if (!presets.length) return null;
  const { masks, toolSets } = catalogFromDeps(deps);
  return resolveMaskPresets(presets, masks, toolSets);
}

export function resolveConversationMaskFromMeta(
  deps: FullRuntimeDeps,
  meta: ConversationMetaMessage | Record<string, never>,
): ResolvedMask | null {
  if (!isConversationMeta(meta)) return null;
  return resolveConversationCapabilityMask(deps, meta.capability_mask);
}

export function resolveSleepMask(deps: FullRuntimeDeps): ResolvedMask {
  const { masks, toolSets } = catalogFromDeps(deps);
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

/** Register built-in / YAML masks at startup (tool mask filter wired in wireEnginePorts) */
export function initMaskSystem(masks: MaskRegistry): void {
  registerBuiltinMasks(masks);
  loadMasksFromYaml(masks);
}

export { checkTool, checkCredential } from "@freeanima/capabilities-tasks/mask";
