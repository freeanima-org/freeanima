import {
  autobiographicalMemoryListBodySchema,
  createConversationBodySchema,
  entityListQuerySchema,
  entitySearchBodySchema,
  entitySearchQuerySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryPinBodySchema,
  subjectEntityCreateBodySchema,
  worldEntityCreateBodySchema,
} from "./schemas.ts";
import { defineHubMethod, httpOnlyMeta } from "../method-def.ts";
import { z } from "zod";

const unknownOutputSchema = z.record(z.string(), z.unknown());
const emptyInputSchema = z.object({}).strict();
const idParamInputSchema = z.object({ id: z.string().min(1) });
const conversationIdParamSchema = z.object({ conversationId: z.string().min(1) });
const cronJobIdParamSchema = z.object({ id: z.string().min(1) });
const nameParamSchema = z.object({ name: z.string().min(1) });
const dayParamSchema = z.object({ day: z.string().min(1) });
const promptDebugQuerySchema = z.object({
  conversation_id: z.string().optional(),
  platform: z.string().optional(),
});
const toolsQuerySchema = z.object({ scope: z.enum(["default"]).optional() });
const pipelineRunsQuerySchema = z.object({
  step_id: z.string().optional(),
  run_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
const cronLogsQuerySchema = z.object({
  job_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  ok: z.boolean().optional(),
});
const autoLlmRunsQuerySchema = z.object({
  run_kind: z.string().optional(),
  status: z.enum(["ok", "error"]).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
const ftsRebuildBodySchema = z.object({ only_missing: z.boolean().optional() });
const sleepCycleBodySchema = z.object({
  day: z.string().optional(),
  deep_sleep_mode: z.enum(["full", "incremental"]).optional(),
});
const configSectionParamSchema = z.object({ section: z.string().min(1) });
const sleepRunStepBodySchema = z.object({
  step_id: z.string().min(1),
  day: z.string().optional(),
  force: z.boolean().optional(),
  deep_sleep_mode: z.enum(["full", "incremental"]).optional(),
});

/** Console 运维面 HTTP-only methods（conversation.* dual 定义在 chat registry） */
export const consoleMethodDefs = {
  "status.get": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/status" }),
  }),
  "status.config": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/status/config" }),
  }),
  "status.tools": defineHubMethod({
    input: toolsQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/status/tools" }),
  }),
  "status.platforms": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/status/platforms" }),
  }),
  "status.cronJobs": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/status/cron-jobs" }),
  }),
  "status.cronJobPause": defineHubMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/status/cron-jobs/{id}/pause" }),
  }),
  "status.cronJobResume": defineHubMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/status/cron-jobs/{id}/resume" }),
  }),
  "status.cronJobRun": defineHubMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/status/cron-jobs/{id}/run" }),
  }),
  "status.restart": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/status/restart" }),
  }),
  "config.get": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/config" }),
  }),
  "config.getSection": defineHubMethod({
    input: configSectionParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/config/{section}" }),
  }),
  "config.patchSection": defineHubMethod({
    input: configSectionParamSchema.extend({ patch: z.record(z.string(), z.unknown()) }),
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "PATCH", path: "/api/config/{section}" }),
  }),
  "config.importFromFile": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/config/import-from-file" }),
  }),
  "memory.files": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/memory/files" }),
  }),
  "memory.search": defineHubMethod({
    input: memorySearchBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/memory/search" }),
  }),
  "memory.semanticCount": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/memory/semantic-memory/count" }),
  }),
  "memory.semanticList": defineHubMethod({
    input: semanticMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/memory/semantic/list" }),
  }),
  "memory.semanticPin": defineHubMethod({
    input: semanticMemoryPinBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "PATCH", path: "/api/memory/semantic/pinned" }),
  }),
  "memory.limbicList": defineHubMethod({
    input: limbicMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/memory/limbic/list" }),
  }),
  "memory.autobiographicalList": defineHubMethod({
    input: autobiographicalMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/memory/autobiographical/list" }),
  }),
  "entity.searchGet": defineHubMethod({
    input: entitySearchQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/entities/search" }),
  }),
  "entity.searchPost": defineHubMethod({
    input: entitySearchBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/entities/search" }),
  }),
  "entity.worldsList": defineHubMethod({
    input: entityListQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/entities/worlds" }),
  }),
  "entity.worldsCreate": defineHubMethod({
    input: worldEntityCreateBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/entities/worlds" }),
  }),
  "entity.worldsGet": defineHubMethod({
    input: idParamInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/entities/worlds/{id}" }),
  }),
  "entity.worldsPatch": defineHubMethod({
    input: z.object({ id: z.string().min(1) }).passthrough(),
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "PATCH", path: "/api/entities/worlds/{id}" }),
  }),
  "entity.subjectsList": defineHubMethod({
    input: entityListQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/entities/subjects" }),
  }),
  "entity.subjectsCreate": defineHubMethod({
    input: subjectEntityCreateBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/entities/subjects" }),
  }),
  "entity.subjectsGet": defineHubMethod({
    input: idParamInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/entities/subjects/{id}" }),
  }),
  "entity.subjectsPatch": defineHubMethod({
    input: z.object({ id: z.string().min(1) }).passthrough(),
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "PATCH", path: "/api/entities/subjects/{id}" }),
  }),
  "self.blocks": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/self/blocks" }),
  }),
  "prompt.debug": defineHubMethod({
    input: promptDebugQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/prompt/debug" }),
  }),
  "src/satellites.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/satellites/status" }),
  }),
  "acp.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/acp/status" }),
  }),
  "acp.startAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/acp/start-all" }),
  }),
  "acp.stopAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/acp/stop-all" }),
  }),
  "acp.startAgent": defineHubMethod({
    input: nameParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/acp/{name}/start" }),
  }),
  "acp.stopAgent": defineHubMethod({
    input: nameParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/acp/{name}/stop" }),
  }),
  "fts.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/fts/status" }),
  }),
  "fts.rebuildStatus": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/fts/rebuild/status" }),
  }),
  "fts.rebuild": defineHubMethod({
    input: ftsRebuildBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/fts/rebuild" }),
  }),
  "sleep.summary": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/sleep/summary" }),
  }),
  "sleep.pipelineRuns": defineHubMethod({
    input: pipelineRunsQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/sleep/pipeline-runs" }),
  }),
  "sleep.deepSleepRounds": defineHubMethod({
    input: dayParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/sleep/deep-sleep/{day}/rounds" }),
  }),
  "sleep.pipelineStatus": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/sleep/pipeline/status" }),
  }),
  "sleep.runPipelineStep": defineHubMethod({
    input: sleepRunStepBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/sleep/pipeline/run-step" }),
  }),
  "sleep.startCycle": defineHubMethod({
    input: sleepCycleBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/sleep/pipeline/run" }),
  }),
  "cronLogs.list": defineHubMethod({
    input: cronLogsQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/cron-logs" }),
  }),
  "autoLlmRuns.list": defineHubMethod({
    input: autoLlmRunsQuerySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/auto-llm-runs" }),
  }),
  "worlds.context": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/worlds/context" }),
  }),
  "conversation.adminGet": defineHubMethod({
    input: conversationIdParamSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/conversations/{conversationId}" }),
  }),
  "conversation.adminListAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/conversations/all" }),
  }),
  "conversation.adminCreate": defineHubMethod({
    input: createConversationBodySchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/conversations" }),
  }),
  "tokens.listForSubject": defineHubMethod({
    input: z.object({ id: z.coerce.number().int().positive() }),
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/subjects/{id}/tokens" }),
  }),
  "tokens.createForSubject": defineHubMethod({
    input: z.object({
      id: z.coerce.number().int().positive(),
      name: z.string().min(1),
    }),
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/subjects/{id}/tokens" }),
  }),
  "tokens.revoke": defineHubMethod({
    input: z.object({ id: z.coerce.number().int().positive() }),
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "DELETE", path: "/api/tokens/{id}" }),
  }),
} as const;
