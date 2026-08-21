import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";

import type { PomodoroActiveStatePayload } from "@freeanima/shared/rpc-contract/frames/pomodoro";
import { randomPublicId } from "@freeanima/shared/util";

import type { PhaseEndPayload } from "./runtime.ts";
import type { PomodoroConfigRow } from "./api.ts";

const MODULE_ID = "pomodoro";

const COMPACT_METHODS = new Set([
  "pomodoro.config.update",
  "pomodoro.active.put",
  "pomodoro.active.clear",
]);

async function removeCompactPeers(scope: string, method: string): Promise<void> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  for (const op of ops) {
    if (op.method === method) await removeOutboxOp(scope, op.id);
  }
}

async function enqueueOp(
  method: string,
  payload: Record<string, unknown>,
  opId?: string,
): Promise<void> {
  const scope = resolveOutboxScope();
  if (COMPACT_METHODS.has(method)) {
    await removeCompactPeers(scope, method);
  }
  const id = opId ?? randomPublicId();
  const op: OfflineOutboxOp = {
    id,
    moduleId: MODULE_ID,
    method,
    payload,
    createdAt: new Date().toISOString(),
  };
  await enqueueOutboxOp(scope, op);
}

export async function enqueuePomodoroSessionComplete(
  subjectId: number,
  payload: PhaseEndPayload,
): Promise<void> {
  await enqueueOp(
    "pomodoro.session.complete",
    { subject_id: subjectId, ...payload },
    payload.client_op_id,
  );
}

export async function enqueuePomodoroSessionAbort(
  subjectId: number,
  payload: PhaseEndPayload,
): Promise<void> {
  await enqueueOp(
    "pomodoro.session.abort",
    { subject_id: subjectId, ...payload },
    payload.client_op_id,
  );
}

export async function enqueuePomodoroConfigUpdate(
  subjectId: number,
  patch: Partial<PomodoroConfigRow>,
): Promise<void> {
  await enqueueOp("pomodoro.config.update", { subject_id: subjectId, ...patch });
}

export async function enqueuePomodoroActivePut(
  subjectId: number,
  active: PomodoroActiveStatePayload,
): Promise<void> {
  await enqueueOp("pomodoro.active.put", { subject_id: subjectId, active });
}

export async function enqueuePomodoroActiveClear(subjectId: number): Promise<void> {
  await enqueueOp("pomodoro.active.clear", { subject_id: subjectId });
}

export async function listPomodoroOutboxOps(): Promise<OfflineOutboxOp[]> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID);
}

export async function ackPomodoroOutboxOp(opId: string): Promise<void> {
  await removeOutboxOp(resolveOutboxScope(), opId);
}

export { MODULE_ID as POMODORO_OUTBOX_MODULE_ID };
