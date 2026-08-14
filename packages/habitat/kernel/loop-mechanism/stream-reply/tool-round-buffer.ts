/** 单轮 tool_begin / tool_result 结构化缓冲 */

import { TOOL_CALL_TITLE_KEY } from "@freeanima/habitat/core/tool";
import type { StructuredToolCall } from "./types.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export function isClarifyTool(name: string): boolean {
  return name === "clarify";
}

function argsPreviewFromObject(argsObj: Record<string, unknown>): string {
  return Object.keys(argsObj)
    .filter((k) => k !== TOOL_CALL_TITLE_KEY)
    .slice(0, 4)
    .map((k) => `${k}=${coerceString(argsObj[k] ?? "").slice(0, 40)}`)
    .join(", ");
}

function isErrorResult(content: string): boolean {
  return (
    content.includes('"error"') || content.startsWith('{"error"') || content.startsWith("Error:")
  );
}

type ToolRoundEntry =
  | { kind: "begin"; name: string; args: Record<string, unknown>; tool_call_id: string }
  | { kind: "progress"; name: string; content: string }
  | { kind: "result"; name: string; content: string }
  | { kind: "error"; content: string };

export class ToolRoundBuffer {
  private entries: ToolRoundEntry[] = [];
  /** 跨轮单调递增，保证 stream tool_call_id 在客户端 upsert 时不冲突 */
  private nextCallId = 0;

  addBegin(name: string, args: Record<string, unknown>): void {
    if (isClarifyTool(name)) return;
    this.entries.push({
      kind: "begin",
      name,
      args,
      tool_call_id: `stream-${this.nextCallId++}`,
    });
  }

  /** 运行中 partial result（保持 status=running） */
  addProgress(name: string, content: string): void {
    if (isClarifyTool(name)) return;
    this.entries.push({ kind: "progress", name, content });
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

  /** 当前轮次快照（不清空）；进行中的 call 保持 running */
  snapshot(): StructuredToolCall[] {
    return this.buildCalls({ finalizeRunning: false });
  }

  take(): StructuredToolCall[] {
    if (this.entries.length === 0) return [];
    const calls = this.buildCalls({ finalizeRunning: true });
    this.entries = [];
    return calls;
  }

  private buildCalls(opts: { finalizeRunning: boolean }): StructuredToolCall[] {
    if (this.entries.length === 0) return [];
    const calls: StructuredToolCall[] = [];
    for (const entry of this.entries) {
      if (entry.kind === "begin") {
        const argsObj = entry.args;
        calls.push({
          name: entry.name,
          args: argsObj,
          argsPreview: argsPreviewFromObject(argsObj),
          tool_call_id: entry.tool_call_id,
          status: "running",
        });
        continue;
      }
      if (entry.kind === "progress") {
        const call = calls.find((c) => c.name === entry.name && c.status === "running");
        if (call) call.result = entry.content;
        continue;
      }
      if (entry.kind === "result") {
        const call = calls.find((c) => c.name === entry.name && c.status === "running");
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

    if (opts.finalizeRunning) {
      for (const call of calls) {
        if (call.status === "running") call.status = "done";
      }
    }
    return calls;
  }
}
