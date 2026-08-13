import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as entityPg from "@freeanima/host/core/db/pg/entity";
import { ToolSetRegistry, runWithToolContext } from "@freeanima/host/core/tool";

import { ANIMA_URI_PROTOCOL_RULE } from "./anima-uri-prompt.ts";
import { handleEntityGet, registerEntitySearchTools } from "./entity-search.ts";

describe("ANIMA_URI_PROTOCOL_RULE", () => {
  it("is compact and names entity_get", () => {
    expect(ANIMA_URI_PROTOCOL_RULE.length).toBeLessThanOrEqual(400);
    expect(ANIMA_URI_PROTOCOL_RULE).toContain("entity_get");
    expect(ANIMA_URI_PROTOCOL_RULE).toContain("[[anima:{id}]]");
  });
});

describe("handleEntityGet", () => {
  let getSpy: ReturnType<typeof spyOn>;
  let accessSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    getSpy = spyOn(entityPg, "getEntity");
    accessSpy = spyOn(entityPg, "assertSubjectCanAccessWorld").mockResolvedValue(undefined);
  });

  afterEach(() => {
    getSpy.mockRestore();
    accessSpy.mockRestore();
  });

  it("returns entity payload when accessible", async () => {
    getSpy.mockResolvedValue({
      id: 42,
      type: "content",
      world_id: 7,
      primary_component: "task_item",
      title: "理发",
      summary: "前刺",
      content: "",
      body: { status: "completed" },
      components: ["task_item"],
      pinned: false,
      reference_count: 0,
      tag_ids: [],
      revisions: [],
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await runWithToolContext(
      "t1",
      async () => {
        const raw = await handleEntityGet({ id: 42 });
        const parsed = JSON.parse(raw) as {
          id: number;
          primary_component: string;
          title: string;
          body: { status: string };
        };
        expect(parsed.id).toBe(42);
        expect(parsed.primary_component).toBe("task_item");
        expect(parsed.title).toBe("理发");
        expect(parsed.body.status).toBe("completed");
        expect(accessSpy).toHaveBeenCalledWith(99, 7, { access: "read" });
      },
      { tools: new ToolSetRegistry(), subjectId: 99 },
    );
  });

  it("errors when entity missing", async () => {
    getSpy.mockResolvedValue(null);
    await runWithToolContext(
      "t2",
      async () => {
        const raw = await handleEntityGet({ id: 1 });
        expect(JSON.parse(raw)).toEqual({ error: "entity not found: 1" });
        expect(accessSpy).not.toHaveBeenCalled();
      },
      { tools: new ToolSetRegistry(), subjectId: 1 },
    );
  });

  it("errors on invalid id", async () => {
    const raw = await handleEntityGet({ id: 0 });
    expect(JSON.parse(raw)).toEqual({ error: "id must be a positive integer" });
  });

  it("maps ToolWorldAccessError to toolError", async () => {
    getSpy.mockResolvedValue({
      id: 3,
      type: "content",
      world_id: 8,
      primary_component: "semantic_memory",
      title: "x",
      summary: "",
      content: "",
      body: {},
      components: ["semantic_memory"],
      pinned: false,
      reference_count: 0,
      tag_ids: [],
      revisions: [],
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    accessSpy.mockRejectedValue(
      new entityPg.ToolWorldAccessError("subject 1 cannot access world 8"),
    );

    await runWithToolContext(
      "t3",
      async () => {
        const raw = await handleEntityGet({ id: 3 });
        expect(JSON.parse(raw)).toEqual({ error: "subject 1 cannot access world 8" });
      },
      { tools: new ToolSetRegistry(), subjectId: 1 },
    );
  });
});

describe("registerEntitySearchTools", () => {
  it("registers entity_get", () => {
    const toolSets = new ToolSetRegistry();
    registerEntitySearchTools(toolSets);
    const def = toolSets.getTool("entity_get");
    expect(def?.name).toBe("entity_get");
    expect(def?.description).toContain("[[anima:id]]");
  });
});
