import { randomBytes } from "node:crypto";

import type { AcpCursorMode, AcpPromptResult } from "./prompt-result.ts";

export type AcpAsyncTaskStatus = "running" | "completed" | "error" | "cancelled" | "timed_out";

export type AcpAsyncTask = {
  taskId: string;
  agentName: string;
  acpSessionId: string;
  animaSessionId: string;
  mode: AcpCursorMode;
  status: AcpAsyncTaskStatus;
  startedAt: number;
  lastProgressAt: number;
  progressNotes: string[];
  lastDeliveredAt: number;
  progressMessageId?: string;
  decisionNotified?: boolean;
  timeoutAt: number;
  result?: AcpPromptResult;
  error?: string;
};

export type AcpAsyncTaskSnapshot = {
  taskId: string;
  agentName: string;
  acpSessionId: string;
  animaSessionId: string;
  mode: AcpCursorMode;
  status: AcpAsyncTaskStatus;
  startedAt: number;
  progressMessageId?: string;
};

export function createTaskId(): string {
  return randomBytes(6).toString("hex");
}

export function toTaskSnapshot(task: AcpAsyncTask): AcpAsyncTaskSnapshot {
  return {
    taskId: task.taskId,
    agentName: task.agentName,
    acpSessionId: task.acpSessionId,
    animaSessionId: task.animaSessionId,
    mode: task.mode,
    status: task.status,
    startedAt: task.startedAt,
    progressMessageId: task.progressMessageId,
  };
}

export function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

export function formatProgressBody(task: AcpAsyncTask): string {
  const elapsed = formatElapsed(Date.now() - task.startedAt);
  const lines = [`Cursor working (task: ${task.taskId}, elapsed ${elapsed})`];
  const merged = mergeProgressFragments(task.progressNotes);
  if (merged.trim()) {
    lines.push(merged);
  } else {
    lines.push("  Progress: waiting for Cursor response...");
  }
  return lines.join("\n");
}

const MAX_PROGRESS_NOTES = 20;
export const PROGRESS_DEBOUNCE_MS = 2_000;

/** Merge streaming fragments; drop duplicate tool hints */
export function mergeProgressFragments(fragments: string[]): string {
  const lines: string[] = [];
  const seenTools = new Set<string>();
  let textBuf = "";
  for (const raw of fragments) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("🔧")) {
      if (textBuf) {
        lines.push(textBuf.trim());
        textBuf = "";
      }
      if (!seenTools.has(trimmed)) {
        seenTools.add(trimmed);
        lines.push(trimmed);
      }
      continue;
    }
    textBuf += trimmed;
  }
  if (textBuf.trim()) lines.push(textBuf.trim());
  return lines.join("\n");
}

export function appendProgressNote(task: AcpAsyncTask, note: string): void {
  const trimmed = note.trim();
  if (!trimmed) return;
  task.progressNotes.push(trimmed);
  if (task.progressNotes.length > MAX_PROGRESS_NOTES) {
    task.progressNotes.splice(0, task.progressNotes.length - MAX_PROGRESS_NOTES);
  }
  task.lastProgressAt = Date.now();
}

export type ProgressDebouncer = {
  push(fragment: string): void;
  flush(): void;
  dispose(): void;
};

export function createProgressDebouncer(
  onFlush: (merged: string) => void,
  debounceMs = PROGRESS_DEBOUNCE_MS,
): ProgressDebouncer {
  let buffer: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flushNow = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!buffer.length) return;
    const merged = mergeProgressFragments(buffer);
    buffer = [];
    if (merged) onFlush(merged);
  };

  return {
    push(fragment: string) {
      const trimmed = fragment.trim();
      if (!trimmed) return;
      buffer.push(trimmed);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushNow, debounceMs);
    },
    flush: flushNow,
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      buffer = [];
    },
  };
}

export class AcpAsyncTaskStore {
  private readonly tasks = new Map<string, AcpAsyncTask>();

  set(task: AcpAsyncTask): void {
    this.tasks.set(task.taskId, task);
  }

  get(taskId: string): AcpAsyncTask | undefined {
    return this.tasks.get(taskId);
  }

  findActive(agentName: string): AcpAsyncTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.agentName === agentName && task.status === "running") return task;
    }
    return undefined;
  }

  listRunning(): AcpAsyncTask[] {
    return [...this.tasks.values()].filter((t) => t.status === "running");
  }

  delete(taskId: string): void {
    this.tasks.delete(taskId);
  }

  clear(): void {
    this.tasks.clear();
  }
}
