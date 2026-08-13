import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  registerSelfLayerRefreshEngine,
  resetSelfLayerRefreshEngineForTests,
} from "../refresh-engine-port.ts";
import {
  resetNotificationPortForTests,
  registerNotificationPort,
} from "@freeanima/host/capabilities/tools/notification";
import type { NotificationPort } from "@freeanima/host/capabilities/tools/notification";
import type { NotificationRow } from "@freeanima/host/core/db/schema/rows";

import { SELF_LAYER_PROPOSAL_SOURCE_REF } from "./messages.ts";
import { runSelfLayerRefresh } from "./run.ts";

const listResidentSemanticMemoryMock = mock(async () => [
  {
    id: 11,
    content: "I prefer careful tooling",
    type: "preference",
    pinned: true,
    reference_count: 4,
    source_conversations: [],
    observed_at: null,
    occurred_at: null,
    status: "active",
    world_id: 1,
    created_at: new Date(0),
    updated_at: new Date(0),
  },
]);
const purgeOrphanSelfBlocksMock = mock(async () => 0);
const loadSelfBlocksMock = mock(async () => [
  {
    block_key: "self_model" as const,
    heading: "Self model",
    content: "Old model",
    locked: false,
    version: 1,
  },
  {
    block_key: "personality_baseline" as const,
    heading: "Personality baseline",
    content: "",
    locked: false,
    version: 0,
  },
  {
    block_key: "direction" as const,
    heading: "Direction and intent",
    content: "",
    locked: false,
    version: 0,
  },
  {
    block_key: "metacognition" as const,
    heading: "Metacognition",
    content: "",
    locked: false,
    version: 0,
  },
  {
    block_key: "existence_anchor" as const,
    heading: "Existence anchor",
    content: "Anchor",
    locked: true,
    version: 1,
  },
]);
const loadSelfLayerPromptMock = mock(async () => "self prompt");

mock.module("@freeanima/host/core/db/pg/semantic-memory", () => ({
  listResidentSemanticMemory: listResidentSemanticMemoryMock,
}));
mock.module("@freeanima/host/core/db/pg/self-layer", () => ({
  purgeOrphanSelfBlocks: purgeOrphanSelfBlocksMock,
}));
mock.module("../load.ts", () => ({
  loadSelfBlocks: loadSelfBlocksMock,
  loadSelfLayerPrompt: loadSelfLayerPromptMock,
}));
mock.module("../cache.ts", () => ({
  invalidateSelfLayerPromptCache: mock(() => undefined),
}));

function makePort(opts?: { unreadProposal?: boolean }): NotificationPort & {
  created: NotificationRow[];
} {
  const created: NotificationRow[] = [];
  return {
    created,
    getAgentRecipient: () => ({ kind: "agent", id: "110" }),
    getUserRecipient: () => ({ kind: "user", id: "109" }),
    async create(input) {
      const row = {
        id: `n-${created.length + 1}`,
        recipient_kind: input.recipient_kind,
        recipient_id: input.recipient_id ?? "110",
        title: input.title,
        body: input.body,
        payload: input.payload ?? null,
        read_at: null,
        created_at: new Date(),
        source_kind: input.source_kind ?? null,
        source_ref: input.source_ref ?? null,
      } as NotificationRow;
      created.push(row);
      return row;
    },
    async list() {
      if (!opts?.unreadProposal) return [];
      return [
        {
          id: "pending",
          recipient_kind: "agent",
          recipient_id: "110",
          title: "自我层维护建议",
          body: "pending",
          payload: null,
          read_at: null,
          created_at: new Date(),
          source_kind: "system",
          source_ref: SELF_LAYER_PROPOSAL_SOURCE_REF,
        },
      ];
    },
    async markRead() {
      return null;
    },
    async markReadBySourceRef() {
      return 0;
    },
    async existsBySourceRef() {
      return false;
    },
  };
}

describe("runSelfLayerRefresh", () => {
  beforeEach(() => {
    listResidentSemanticMemoryMock.mockClear();
    purgeOrphanSelfBlocksMock.mockClear();
    loadSelfBlocksMock.mockClear();
    resetSelfLayerRefreshEngineForTests();
    resetNotificationPortForTests();
  });

  afterEach(() => {
    resetSelfLayerRefreshEngineForTests();
    resetNotificationPortForTests();
  });

  it("skips when unread proposal pending", async () => {
    registerNotificationPort(makePort({ unreadProposal: true }));
    registerSelfLayerRefreshEngine(async () => ({ content: '{"propose":true}' }));
    const result = await runSelfLayerRefresh();
    expect(result.skipped).toBe("pending_proposal");
    expect(result.proposed).toBe(false);
  });

  it("skips when evidence empty", async () => {
    listResidentSemanticMemoryMock.mockImplementationOnce(async () => []);
    registerNotificationPort(makePort());
    registerSelfLayerRefreshEngine(async () => ({ content: '{"propose":true}' }));
    const result = await runSelfLayerRefresh();
    expect(result.skipped).toBe("no_evidence");
  });

  it("skips when LLM proposes no change", async () => {
    const port = makePort();
    registerNotificationPort(port);
    registerSelfLayerRefreshEngine(async () => ({ content: '{"propose":false}' }));
    const result = await runSelfLayerRefresh();
    expect(result.skipped).toBe("no_change");
    expect(port.created).toHaveLength(0);
  });

  it("creates agent inbox proposal when LLM proposes blocks", async () => {
    const port = makePort();
    registerNotificationPort(port);
    registerSelfLayerRefreshEngine(async () => ({
      content: JSON.stringify({
        propose: true,
        rationale: "Careful tooling shows up often",
        evidence_ids: [11],
        blocks: { self_model: "I am careful with tools." },
      }),
    }));
    const result = await runSelfLayerRefresh({ selfContent: "self" });
    expect(result.proposed).toBe(true);
    expect(result.notification_id).toBe("n-1");
    expect(port.created).toHaveLength(1);
    expect(port.created[0]?.source_ref).toBe(SELF_LAYER_PROPOSAL_SOURCE_REF);
    expect(port.created[0]?.body).toContain("I am careful with tools.");
  });
});
