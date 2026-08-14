import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { homePath } from "@freeanima/habitat/core/config/paths";

/** Max chars returned in tool content for LLM / persistence (preview). */
export const TOOL_OUTPUT_PREVIEW_MAX = 50 * 1024;

/** Max chars we will capture into an artifact for non-idempotent spill. */
export const TOOL_OUTPUT_CAPTURE_MAX = 2 * 1024 * 1024;

export function toolArtifactsDir(): string {
  const dir = homePath("tool-artifacts");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write full output to ~/.anima/tool-artifacts; returns absolute path. */
export function spillToolOutputArtifact(full: string, kind: string): string {
  const safeKind = kind.replaceAll(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "tool";
  const path = join(
    toolArtifactsDir(),
    `${safeKind}-${Date.now()}-${randomUUID().slice(0, 8)}.txt`,
  );
  writeFileSync(path, full, "utf-8");
  return path;
}

export function appendToolOutputArtifact(artifactPath: string, chunk: string): void {
  appendFileSync(artifactPath, chunk, "utf-8");
}

/**
 * For non-idempotent / side-effecting tools: if over preview budget, spill full text
 * and return preview + artifact_path + file_read guidance (do not re-run).
 */
export function formatOversizedToolOutput(
  full: string,
  opts: { kind: string; emptyLabel?: string },
): string {
  const emptyLabel = opts.emptyLabel ?? "(no output)";
  if (!full) return emptyLabel;
  if (full.length <= TOOL_OUTPUT_PREVIEW_MAX) return full;

  const captured =
    full.length > TOOL_OUTPUT_CAPTURE_MAX ? full.slice(0, TOOL_OUTPUT_CAPTURE_MAX) : full;
  const artifact_path = spillToolOutputArtifact(captured, opts.kind);
  const preview = full.slice(0, TOOL_OUTPUT_PREVIEW_MAX);
  const captureNote =
    full.length > TOOL_OUTPUT_CAPTURE_MAX
      ? ` (artifact holds first ${TOOL_OUTPUT_CAPTURE_MAX} of ${full.length} chars)`
      : "";
  return (
    `${preview}\n\n` +
    `[truncated: showing ${TOOL_OUTPUT_PREVIEW_MAX} of ${full.length} chars; full output saved${captureNote}]\n` +
    `artifact_path: ${artifact_path}\n` +
    `truncated: true\n` +
    `Use file_read(path="${artifact_path}", offset=1, limit=500) to continue reading. Do not re-run the command.`
  );
}

/** Idempotent-read hint when a page is truncated (same-tool refetch). */
export function idempotentTruncationSuffix(opts: {
  remainingHint: string;
  howToFetchMore: string;
}): string {
  return `\n\n[truncated: ${opts.remainingHint}; ${opts.howToFetchMore}]`;
}
