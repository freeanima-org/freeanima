import type { MaskRegistry } from "./registry.ts";
import type { Mask, ResolvedMask } from "./types.ts";
import { mergeMaskChain } from "./merge.ts";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

function collectInheritanceChain(name: string, registry: MaskRegistry, visiting: string[]): Mask[] {
  if (visiting.includes(name)) {
    throw new Error(`Circular inheritance: ${[...visiting, name].join("→")}`);
  }
  const mask = registry.get(name);
  if (!mask) {
    throw new Error(`Mask '${name}' not found`);
  }
  const chain: Mask[] = [];
  for (const parentName of mask.inherits) {
    chain.push(...collectInheritanceChain(parentName, registry, [...visiting, name]));
  }
  chain.push(mask);
  return chain;
}

function collectMaskAncestors(mask: Mask, registry: MaskRegistry, visiting: string[]): Mask[] {
  const chain: Mask[] = [];
  for (const parentName of mask.inherits) {
    if (visiting.includes(parentName)) {
      throw new Error(`Circular inheritance: ${[...visiting, parentName].join("→")}`);
    }
    const parent = registry.get(parentName);
    if (!parent) {
      throw new Error(`Unknown mask '${parentName}' in inherits`);
    }
    chain.push(...collectMaskAncestors(parent, registry, [...visiting, parentName]));
    chain.push(parent);
  }
  return chain;
}

/** 展开 inherits 链并合并为最终面具 */
export function resolveMask(
  mask: Mask,
  registry: MaskRegistry,
  toolSetRegistry: ToolSetRegistry,
): ResolvedMask {
  const chain = [...collectMaskAncestors(mask, registry, []), mask];
  return mergeMaskChain(chain, toolSetRegistry);
}

/** 按注册名解析命名面具（含 inherits） */
export function resolveMaskByName(
  name: string,
  registry: MaskRegistry,
  toolSetRegistry: ToolSetRegistry,
): ResolvedMask {
  const chain = collectInheritanceChain(name.trim(), registry, []);
  return mergeMaskChain(chain, toolSetRegistry);
}

/** 合并多个 preset 解析结果 */
export function resolveMaskPresets(
  presetNames: readonly string[],
  registry: MaskRegistry,
  toolSetRegistry: ToolSetRegistry,
): ResolvedMask {
  const resolved = presetNames.map((preset) => {
    const mask = registry.get(preset);
    if (!mask) {
      throw new Error(`Unknown mask preset '${preset}'`);
    }
    return resolveMask(mask, registry, toolSetRegistry);
  });
  if (!resolved.length) {
    return {
      allowed_tools: [],
      denied_tools: [],
      auto_skills: [],
      credentials: [],
    };
  }
  if (resolved.length === 1) {
    return resolved[0]!;
  }
  const mergedChain: Mask[] = resolved.map((r) => ({
    inherits: [],
    allowed_tools: [...r.allowed_tools],
    denied_tools: [...r.denied_tools],
    auto_skills: [...r.auto_skills],
    credentials: [...r.credentials],
  }));
  return mergeMaskChain(mergedChain, toolSetRegistry);
}
