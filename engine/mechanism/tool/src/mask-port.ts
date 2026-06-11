import type { SessionMetaMessage } from "@freeanima/engine-db/domain";

export type SessionToolMaskFilter = (toolNames: string[], meta: SessionMetaMessage) => string[];

let sessionToolMaskFilter: SessionToolMaskFilter | null = null;

/** Injected by service composition root (avoids engine-conversation depending on capabilities-mask) */
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

/** Whether capability mask preset is configured */
export function sessionHasCapabilityMask(meta: SessionMetaMessage): boolean {
  return (meta.capability_mask?.presets.length ?? 0) > 0;
}
