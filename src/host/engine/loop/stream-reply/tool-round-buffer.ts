/** 单轮 tool_begin / tool_result 结构化缓冲 */

import { TOOL_CALL_TITLE_KEY } from "@freeanima/host/core/tool";
import type { StructuredToolCall } from "./types.ts";

export function isClarifyTool(name: string): boolean {
  return name === "clarify";
}

function argsPreviewFromObject(argsObj: Record<string, unknown>): string {
  return Object.keys(argsObj)
    .filter((k) => k !== TOOL_CALL_TITLE_KEY)
    .slice(0, 4)
    .map((k) => `${k}=${String(argsObj[k] ?? "").slice(0, 40)}`)
    .join(", ");
}

function isErrorResult(content: string): boolean {
  return (
    content.includes('"error"') || content.startsWith('{"error"') || content.startsWith("Error:")
  );
}

type ToolRoundEntry =
  | { kind: "begin"; name: string; args: Record<string, unknown> }
  | { kind: "result"; name: string; content: string }
  | { kind: "error"; content: string };

export class ToolRoundBuffer {
  private entries: ToolRoundEntry[] = [];
  private nextCallId = 0;

  addBegin(name: string, args: Record<string, unknown>): void {
    if (isClarifyTool(name)) return;
    this.entries.push({ kind: "begin", name, args });
  }

  addResult(name: string, content: string): void {
    if (isClarifyTool(name)) return;
    this.entries.push({ kind: "result", name, content });
  }

  addError(content: string): void {
    this.entries.push({ kind: "error", content });
  }

  get hasContent(): boolean {
    return this.entries.length > 0;
  }

  take(): StructuredToolCall[] {
    if (this.entries.length === 0) return [];
    const entries = this.entries;
    this.entries = [];
    this.nextCallId = 0;

    const calls: StructuredToolCall[] = [];
    for (const entry of entries) {
      if (entry.kind === "begin") {
        const argsObj = entry.args;
        calls.push({
          name: entry.name,
          args: argsObj,
          argsPreview: argsPreviewFromObject(argsObj),
          tool_call_id: `stream-${this.nextCallId++}`,
          status: "running",
        });
        continue;
      }
      if (entry.kind === "result") {
        const call = calls.find(
          (c) => c.name === entry.name && c.status === "running" && c.result === undefined,
        );
        if (call) {
          call.result = entry.content;
          call.status = isErrorResult(entry.content) ? "error" : "done";
        }
        continue;
      }
      if (entry.kind === "error") {
        const call = calls.findLast((c) => c.status === "running" && !c.result);
        if (call) {
          call.result = entry.content;
          call.status = "error";
        }
      }
    }

    for (const call of calls) {
      if (call.status === "running") call.status = "done";
    }
    return calls;
  }
}
