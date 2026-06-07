import type { SessionMetaMessage } from "./message.ts";

export type SessionToolMaskFilter = (toolNames: string[], meta: SessionMetaMessage) => string[];

let sessionToolMaskFilter: SessionToolMaskFilter | null = null;

/** 由 service 组合根注入（避免 engine-conversation 依赖 capabilities-mask） */
export function registerSessionToolMaskFilter(filter: SessionToolMaskFilter): void {
  sessionToolMaskFilter = filter;
}

export function applySessionToolMaskFilter(
  toolNames: string[],
  meta: SessionMetaMessage,
): string[] {
  if (!sessionToolMaskFilter) return toolNames;
  return sessionToolMaskFilter(toolNames, meta);
}

/** 是否配置了能力面罩 preset */
export function sessionHasCapabilityMask(meta: SessionMetaMessage): boolean {
  return (meta.capability_mask?.presets.length ?? 0) > 0;
}
