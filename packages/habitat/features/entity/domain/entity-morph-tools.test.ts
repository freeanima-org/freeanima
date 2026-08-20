import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as entityPg from "@freeanima/habitat/core/db/pg/entity";
import { ToolSetRegistry, runWithToolContext, type ToolDef } from "@freeanima/habitat/core/tool";

import { buildEntityMorphToolDefs } from "./entity-morph-tools.ts";

function contentRow(partial: Record<string, unknown> = {}) {
  return {
    id: 10,
    type: "content" as const,
    world_id: 7,
    primary_component: "note",
    title: "n",
    summary: "",
    content: "",
    body: { client_op_id: null },
    components: ["note"],
    pinned: false,
    reference_count: 0,
    tag_ids: [],
    revisions: [],
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  };
}

function toolByName(tools: ToolDef[], name: string): ToolDef {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`missing tool: ${name}`);
  return tool;
}

describe("entity morph tools", () => {
  let getSpy: ReturnType<typeof spyOn>;
  let accessSpy: ReturnType<typeof spyOn>;
  let addSpy: ReturnType<typeof spyOn>;
  let deleteSpy: ReturnType<typeof spyOn>;
  let promoteSpy: ReturnType<typeof spyOn>;
  const tools = buildEntityMorphToolDefs();

  beforeEach(() => {
    getSpy = spyOn(entityPg, "getEntity");
    accessSpy = spyOn(entityPg, "assertSubjectCanAccessWorld").mockResolvedValue(undefined);
    addSpy = spyOn(entityPg, "addEntityComponent");
    deleteSpy = spyOn(entityPg, "deleteEntityComponent");
    promoteSpy = spyOn(entityPg, "promoteEntityComponent");
  });

  afterEach(() => {
    getSpy.mockRestore();
    accessSpy.mockRestore();
    addSpy.mockRestore();
    deleteSpy.mockRestore();
    promoteSpy.mockRestore();
  });

  it("entity_attach_component attaches and checks write access", async () => {
    getSpy.mockResolvedValue(contentRow());
    addSpy.mockResolvedValue(
      contentRow({
        components: ["note", "diary_entry"],
        body: { client_op_id: null, entry_at: "2026-08-19T00:00:00.000+08:00" },
      }),
    );

    await runWithToolContext(
      "m1",
      async () => {
        const raw = await toolByName(tools, "entity_attach_component").handler({
          id: 10,
          component: "diary_entry",
          body: { entry_at: "2026-08-19T00:00:00.000+08:00" },
        });
        expect(JSON.parse(raw)).toEqual({
          id: 10,
          components: ["note", "diary_entry"],
          primary_component: "note",
        });
        expect(accessSpy).toHaveBeenCalledWith(3, 7, { access: "write" });
      },
      { tools: new ToolSetRegistry(), subjectId: 3 },
    );
  });

  it("entity_attach_component rejects identity component", async () => {
    getSpy.mockResolvedValue(contentRow());
    await runWithToolContext(
      "m2",
      async () => {
        const raw = await toolByName(tools, "entity_attach_component").handler({
          id: 10,
          component: "agent_config",
        });
        expect(JSON.parse(raw).error).toMatch(/identity/);
        expect(addSpy).not.toHaveBeenCalled();
      },
      { tools: new ToolSetRegistry(), subjectId: 3 },
    );
  });

  it("entity_promote_component promotes secondary", async () => {
    getSpy.mockResolvedValue(
      contentRow({
        components: ["note", "diary_entry"],
        body: { entry_at: "2026-08-19T00:00:00.000+08:00", client_op_id: "a" },
      }),
    );
    promoteSpy.mockResolvedValue(
      contentRow({
        primary_component: "diary_entry",
        components: ["note", "diary_entry"],
        body: { entry_at: "2026-08-19T00:00:00.000+08:00", client_op_id: "a" },
      }),
    );

    await runWithToolContext(
      "m3",
      async () => {
        const raw = await toolByName(tools, "entity_promote_component").handler({
          id: 10,
          component: "diary_entry",
        });
        expect(JSON.parse(raw)).toEqual({
          id: 10,
          components: ["note", "diary_entry"],
          primary_component: "diary_entry",
        });
      },
      { tools: new ToolSetRegistry(), subjectId: 3 },
    );
  });

  it("entity_detach_component detaches", async () => {
    getSpy.mockResolvedValue(
      contentRow({ components: ["note", "diary_entry"], primary_component: "note" }),
    );
    deleteSpy.mockResolvedValue(contentRow({ components: ["note"] }));

    await runWithToolContext(
      "m4",
      async () => {
        const raw = await toolByName(tools, "entity_detach_component").handler({
          id: 10,
          component: "diary_entry",
        });
        expect(JSON.parse(raw).components).toEqual(["note"]);
      },
      { tools: new ToolSetRegistry(), subjectId: 3 },
    );
  });
});
