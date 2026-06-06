import { randomBytes } from "node:crypto";

import type { AcpCursorMode, AcpPromptResult } from "./prompt-result.ts";

export type AcpAsyncTaskStatus = "running" | "completed" | "error" | "cancelled" | "timed_out";

export type AcpAsyncTask = {
  taskId: string;
  agentName: string;
  acpSessionId: string;
  nestSessionId: string;
  mode: AcpCursorMode;
  status: AcpAsyncTaskStatus;
  startedAt: number;
  lastProgressAt: number;
  progressNotes: string[];
  lastDeliveredAt: number;
  progressMessageId?: string;
  timeoutAt: number;
  result?: AcpPromptResult;
  error?: string;
};

export type AcpAsyncTaskSnapshot = {
  taskId: string;
  agentName: string;
  acpSessionId: string;
  nestSessionId: string;
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
    nestSessionId: task.nestSessionId,
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
  const lines = [`Cursor 工作中 (task: ${task.taskId}, 已运行 ${elapsed})`];
  const recent = task.progressNotes.slice(-5);
  if (recent.length) {
    for (const note of recent) {
      lines.push(`  进度: ${note}`);
    }
  } else {
    lines.push("  进度: 等待 Cursor 响应...");
  }
  return lines.join("\n");
}

const MAX_PROGRESS_NOTES = 20;

export function appendProgressNote(task: AcpAsyncTask, note: string): void {
  const trimmed = note.trim();
  if (!trimmed) return;
  task.progressNotes.push(trimmed);
  if (task.progressNotes.length > MAX_PROGRESS_NOTES) {
    task.progressNotes.splice(0, task.progressNotes.length - MAX_PROGRESS_NOTES);
  }
  task.lastProgressAt = Date.now();
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
