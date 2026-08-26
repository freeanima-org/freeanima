import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsManager } from "@freeanima/habitat/capabilities/outpost";
import { CODING_APP_ID } from "@freeanima/shared/coding/constants.ts";
import type {
  CodingNoteCreateInput,
  CodingNoteListInput,
  CodingNoteRowPayload,
  CodingOutpostExecInput,
  CodingProjectContextSyncInput,
} from "@freeanima/shared/rpc-contract/frames/coding.ts";
import type { ProjectAgentContextSnapshot } from "@freeanima/shared/coding/project-agent-context";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";

import { createCodingNote, listCodingNotes, type CodingNoteRow } from "../domain/note-store.ts";
import { setProjectAgentContext } from "@freeanima/shared/coding/project-context-cache.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function toPayload(row: CodingNoteRow): CodingNoteRowPayload {
  return omitUndefined({
    id: row.id,
    world_id: row.world_id,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  });
}

export async function serviceCodingNoteCreate(deps: RuntimeDeps, input: CodingNoteCreateInput) {
  assertPg(deps);
  const item = await createCodingNote(
    omitUndefined({
      world_id: input.world_id,
      title: input.title,
      summary: input.summary,
      content: input.content,
      kind: input.kind,
    }),
  );
  return { item: toPayload(item) };
}

export async function serviceCodingNoteList(deps: RuntimeDeps, input: CodingNoteListInput) {
  assertPg(deps);
  const { items, count } = await listCodingNotes(
    omitUndefined({
      world_id: input.world_id,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items: items.map(toPayload), count };
}

export async function serviceProjectContextSync(
  _deps: RuntimeDeps,
  input: CodingProjectContextSyncInput,
) {
  const snapshot = assertNarrow<ProjectAgentContextSnapshot>(input.snapshot);
  setProjectAgentContext(input.conversation_id, snapshot);
  // 清空缓存 prompt，下次 turn / ensureSystemPromptFresh 会全量重建并读到新 snapshot
  try {
    const { patchConversationMeta } = await import("@freeanima/habitat/core/db/pg/conversation");
    await patchConversationMeta(input.conversation_id, {
      system_prompt: "",
      system_prompt_built_at: undefined,
    });
  } catch {
    // PG 未就绪时仅内存缓存
  }
  return { ok: true as const, conversation_id: input.conversation_id };
}

export async function serviceCodingOutpostExec(
  manager: RemoteToolsManager,
  input: CodingOutpostExecInput,
) {
  const content = await manager.invokeLocalTool({
    appId: CODING_APP_ID,
    instanceId: input.instance_id,
    localName: input.tool,
    args: input.args ?? {},
    ...(input.workspace_root ? { workspaceRoot: input.workspace_root } : {}),
    ...(input.conversation_id ? { conversationId: input.conversation_id } : {}),
  });
  return { ok: true as const, content };
}
