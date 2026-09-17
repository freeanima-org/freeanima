import type {
  PassiveRecallDebugHit,
  PassiveRecallDebugTrace,
} from "@freeanima/shared/rpc-contract/frames/message";

export type { PassiveRecallDebugHit, PassiveRecallDebugTrace };

export const PASSIVE_RECALL_DEBUG_PREVIEW_CHARS = 120;

export function previewPassiveContent(
  content: string,
  max = PASSIVE_RECALL_DEBUG_PREVIEW_CHARS,
): string {
  const trimmed = content.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}
