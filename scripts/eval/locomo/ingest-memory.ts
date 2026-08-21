import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/pg/semantic-memory/types";
import {
  createEmbeddedMemoryService,
  registerRetainEngine,
  resetRetainEngineForTests,
  type MemoryService,
} from "@freeanima/habitat/capabilities/memory/service";

import type { FlatTurn, LocomoSample } from "./types.ts";
import { asString } from "./coerce.ts";
import { asRecord } from "@freeanima/shared/util";

function row(
  partial: Partial<SemanticMemoryRow> & Pick<SemanticMemoryRow, "id" | "content">,
): SemanticMemoryRow {
  const now = new Date();
  return {
    type: "observation",
    pinned: false,
    source_conversations: ["c"],
    source: { conversation_id: "c", message_ids: ["1"] },
    links: [],
    observed_at: now,
    occurred_at: null,
    status: "active",
    reference_count: 0,
    created_at: now,
    updated_at: now,
    world_id: 1,
    ...partial,
  };
}

/** dry-run / 无 compose：in-memory MemoryService */
export function createEvalMemoryHarness(): {
  service: MemoryService;
  store: Map<number, SemanticMemoryRow>;
  messageTexts: Map<string, string>;
} {
  const store = new Map<number, SemanticMemoryRow>();
  const messageTexts = new Map<string, string>();
  let seq = 1;

  const service = createEmbeddedMemoryService({
    deps: {
      createSemanticMemory: async (input) => {
        const id = seq++;
        store.set(
          id,
          row({
            id,
            content: input.content,
            type: input.type ?? "observation",
            source: input.source ?? null,
            source_conversations: input.source_conversations ?? [],
            pinned: input.pinned ?? false,
          }),
        );
        return id;
      },
      getSemanticMemory: async (id) => store.get(Number(id)) ?? null,
      listActiveSemanticMemory: async () =>
        [...store.values()].filter((r) => r.status === "active"),
      listResidentSemanticMemory: async () =>
        [...store.values()].filter((r) => r.pinned && r.status === "active"),
      updateSemanticMemory: async (input) => {
        const cur = store.get(Number(input.id));
        if (!cur) return;
        const next: SemanticMemoryRow = {
          ...cur,
          content: input.content ?? cur.content,
          type: input.type ?? cur.type,
          pinned: input.pinned ?? cur.pinned,
          status: input.status ?? cur.status,
          links: input.links ?? cur.links ?? [],
          observed_at:
            input.observed_at !== undefined
              ? input.observed_at instanceof Date || input.observed_at === null
                ? input.observed_at
                : new Date(input.observed_at)
              : cur.observed_at,
          occurred_at: input.occurred_at !== undefined ? input.occurred_at : cur.occurred_at,
          updated_at: new Date(),
        };
        if (input.source !== undefined) next.source = input.source;
        store.set(Number(input.id), next);
      },
      deprecateSemanticMemory: async (id) => {
        const cur = store.get(Number(id));
        if (!cur) return false;
        store.set(Number(id), { ...cur, status: "deprecated", updated_at: new Date() });
        return true;
      },
      getMessageTextItemsByIds: async (_conversationId, messageIds) =>
        messageIds
          .map((id) => {
            const content = messageTexts.get(id);
            if (!content) return null;
            return { message_id: id, content, role: "user" as const, timestamp: "" };
          })
          .filter((x): x is NonNullable<typeof x> => x != null),
      bumpReferenceCountsFromTexts: async () => [],
      watermarkStore: {
        get: async () => null,
        set: async () => {},
      },
    },
  });

  return { service, store, messageTexts };
}

export function flattenConversation(sample: LocomoSample): FlatTurn[] {
  const conv = sample.conversation;
  const sessionKeys = Object.keys(conv)
    .filter((k) => /^session_\d+$/.test(k))
    .toSorted((a, b) => {
      const na = Number(a.slice("session_".length));
      const nb = Number(b.slice("session_".length));
      return na - nb;
    });

  const turns: FlatTurn[] = [];
  for (const sessionKey of sessionKeys) {
    const dateKey = `${sessionKey}_date_time`;
    const dateRaw = conv[dateKey];
    const sessionDateTime = typeof dateRaw === "string" ? dateRaw : undefined;
    const raw = conv[sessionKey];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const t = asRecord(item);
      if (!t) continue;
      const speaker = asString(t.speaker);
      const dia_id = asString(t.dia_id, `${sessionKey}:${turns.length}`);
      let text = typeof t.text === "string" ? t.text : "";
      if (typeof t.blip_caption === "string" && t.blip_caption.trim()) {
        text = text ? `${text} [image: ${t.blip_caption}]` : `[image: ${t.blip_caption}]`;
      }
      if (!text.trim()) continue;
      const turn: FlatTurn = {
        sessionKey,
        dia_id,
        speaker,
        text: text.trim(),
      };
      if (sessionDateTime !== undefined) turn.sessionDateTime = sessionDateTime;
      turns.push(turn);
    }
  }
  return turns;
}

export function formatTranscript(turns: FlatTurn[]): string {
  const lines: string[] = [];
  let lastSession = "";
  for (const t of turns) {
    if (t.sessionKey !== lastSession) {
      lastSession = t.sessionKey;
      const when = t.sessionDateTime ? ` (${t.sessionDateTime})` : "";
      lines.push(`\n## ${t.sessionKey}${when}`);
    }
    lines.push(`${t.speaker} [${t.dia_id}]: ${t.text}`);
  }
  return lines.join("\n").trim();
}

export async function ingestSampleMemory(opts: {
  sample: LocomoSample;
  harness: ReturnType<typeof createEvalMemoryHarness>;
}): Promise<{ conversationId: string; turns: FlatTurn[]; transcript: string; retained: number }> {
  const { sample, harness } = opts;
  const conversationId = `locomo-${sample.sample_id}`;
  const turns = flattenConversation(sample);
  const transcript = formatTranscript(turns);

  resetRetainEngineForTests();
  registerRetainEngine(async ({ texts }) => ({
    items: texts
      .map((content) => content.trim())
      .filter(Boolean)
      .map((content) => ({
        action: "create" as const,
        content,
        kind: "observation",
      })),
  }));

  let retained = 0;
  const bySession = new Map<string, FlatTurn[]>();
  for (const t of turns) {
    const list = bySession.get(t.sessionKey) ?? [];
    list.push(t);
    bySession.set(t.sessionKey, list);
  }

  for (const [, sessionTurns] of bySession) {
    const message_ids: string[] = [];
    const texts: string[] = [];
    for (const t of sessionTurns) {
      const mid = t.dia_id;
      harness.messageTexts.set(mid, `${t.speaker}: ${t.text}`);
      message_ids.push(mid);
      texts.push(`${t.speaker}: ${t.text}`);
    }
    await harness.service.syncTurn({
      conversation_id: conversationId,
      message_ids,
      texts,
      trigger_retain: false,
    });
    const result = await harness.service.retain({
      conversation_id: conversationId,
      message_ids,
      force: true,
    });
    retained += result.created.length;
  }

  return { conversationId, turns, transcript, retained };
}

export async function recallLocal(
  service: MemoryService,
  query: string,
  limit = 8,
): Promise<Array<{ id: number; content: string; score: number }>> {
  const records = await service.list({ status: "active", limit: 500 });
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  const scored = records.map((r) => {
    const hay = r.content.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (hay.includes(tok)) score += 1;
    }
    return { id: r.id, content: r.content, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit);
}
