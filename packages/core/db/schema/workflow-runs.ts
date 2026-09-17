import { bigint, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { entities } from "./entity/entity.ts";

/** Workflow 顶层运行记录：仅 {input,output}；中间步不落盘 */
export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    /** 具名固化实体；临时 run 可空 */
    workflow_entity_id: bigint("workflow_entity_id", { mode: "number" }).references(
      () => entities.id,
    ),
    /** 具名 title；临时可空 */
    name: text("name"),
    input: jsonb("input").$type<unknown>().notNull().default({}),
    output: jsonb("output").$type<unknown>(),
    status: text("status").notNull(),
    error: text("error"),
    subject_id: bigint("subject_id", { mode: "number" }).references(() => entities.id),
    world_id: bigint("world_id", { mode: "number" }).references(() => entities.id),
    created_at: pgTimestamptz("created_at").notNull(),
    finished_at: pgTimestamptz("finished_at"),
  },
  (t) => [
    index("idx_workflow_runs_entity_created").on(t.workflow_entity_id, t.created_at),
    index("idx_workflow_runs_name_created").on(t.name, t.created_at),
    index("idx_workflow_runs_world_created").on(t.world_id, t.created_at),
  ],
);
