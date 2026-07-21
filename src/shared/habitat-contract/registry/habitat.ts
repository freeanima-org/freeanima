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
  worldEntityPatchInputSchema,
} from "./schemas.ts";
import {
  binaryHttpMeta,
  defineHabitatMethod,
  dualTransportMeta,
  publicHttpMeta,
  rawPublicHttpMeta,
} from "../method-def.ts";
import { z } from "zod";

const unknownOutputSchema = z.record(z.string(), z.unknown());
const emptyInputSchema = z.object({}).strict();
const idParamInputSchema = z.object({ id: z.string().min(1) });
const conversationIdParamSchema = z.object({ conversationId: z.string().min(1) });
const cronJobIdParamSchema = z.object({ id: z.string().min(1) });
const nameParamSchema = z.object({ name: z.string().min(1) });
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
const configTestConnectionInputSchema = z.object({
  service: z.enum(["firecrawl", "camofox", "embedding", "llm_provider", "discord", "weixin"]),
  config: z.record(z.string(), z.unknown()).optional(),
  provider_id: z.string().min(1).optional(),
});
const configTestConnectionOutputSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  latency_ms: z.number().int().nonnegative().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
const sleepRunStepBodySchema = z.object({
  step_id: z.string().min(1),
  day: z.string().optional(),
  force: z.boolean().optional(),
  deep_sleep_mode: z.enum(["full", "incremental"]).optional(),
});
const tlsCaQrInputSchema = z.object({
  size: z.coerce.number().int().min(128).max(512).optional(),
});
const ttsSynthesizeInputSchema = z.object({
  text: z.string().min(1),
  lang: z.string().optional(),
  voice: z.string().optional(),
  app_locale: z.string().optional(),
  rate: z.number().min(0.1).max(10).optional(),
  pitch: z.number().min(0).max(2).optional(),
  volume: z.number().min(0).max(1).optional(),
});

/** Habitat 运维面 HTTP-only methods（conversation.* dual 定义在 chat registry） */
export const habitatMethodDefs = {
  "health.probe": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: publicHttpMeta(),
  }),
  "tls.ca.info": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: publicHttpMeta(),
  }),
  "tls.ca.qr": defineHabitatMethod({
    input: tlsCaQrInputSchema,
    output: unknownOutputSchema,
    meta: rawPublicHttpMeta(),
  }),
  "tls.ca": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: rawPublicHttpMeta(),
  }),
  "status.get": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.tools": defineHabitatMethod({
    input: toolsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.platforms": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.cronJobs": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.cronJobPause": defineHabitatMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "status.cronJobResume": defineHabitatMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "status.cronJobRun": defineHabitatMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "status.restart": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "config.get": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "config.getSection": defineHabitatMethod({
    input: configSectionParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "config.patchSection": defineHabitatMethod({
    input: configSectionParamSchema.extend({ patch: z.record(z.string(), z.unknown()) }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "config.replaceSection": defineHabitatMethod({
    input: configSectionParamSchema.extend({ value: z.record(z.string(), z.unknown()) }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "config.testConnection": defineHabitatMethod({
    input: configTestConnectionInputSchema,
    output: configTestConnectionOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.files": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "memory.search": defineHabitatMethod({
    input: memorySearchBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.semanticCount": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.semanticList": defineHabitatMethod({
    input: semanticMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.semanticPin": defineHabitatMethod({
    input: semanticMemoryPinBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.limbicList": defineHabitatMethod({
    input: limbicMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.autobiographicalList": defineHabitatMethod({
    input: autobiographicalMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.searchGet": defineHabitatMethod({
    input: entitySearchQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.searchPost": defineHabitatMethod({
    input: entitySearchBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.worldsList": defineHabitatMethod({
    input: entityListQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.worldsCreate": defineHabitatMethod({
    input: worldEntityCreateBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.worldsGet": defineHabitatMethod({
    input: idParamInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.worldsPatch": defineHabitatMethod({
    input: worldEntityPatchInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.subjectsList": defineHabitatMethod({
    input: entityListQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.subjectsCreate": defineHabitatMethod({
    input: subjectEntityCreateBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.subjectsGet": defineHabitatMethod({
    input: idParamInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.subjectsPatch": defineHabitatMethod({
    input: z.object({ id: z.string().min(1) }).passthrough(),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "self.blocks": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "prompt.debug": defineHabitatMethod({
    input: promptDebugQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "src/satellites.status": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "acp.status": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "acp.startAll": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "acp.stopAll": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "acp.startAgent": defineHabitatMethod({
    input: nameParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "acp.stopAgent": defineHabitatMethod({
    input: nameParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "fts.status": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "fts.rebuildStatus": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "fts.rebuild": defineHabitatMethod({
    input: ftsRebuildBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "sleep.summary": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "sleep.pipelineRuns": defineHabitatMethod({
    input: pipelineRunsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "sleep.pipelineStatus": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "sleep.runPipelineStep": defineHabitatMethod({
    input: sleepRunStepBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "sleep.startCycle": defineHabitatMethod({
    input: sleepCycleBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "cronLogs.list": defineHabitatMethod({
    input: cronLogsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "autoLlmRuns.list": defineHabitatMethod({
    input: autoLlmRunsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "worlds.context": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.adminGet": defineHabitatMethod({
    input: conversationIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.adminListAll": defineHabitatMethod({
    input: z.object({
      offset: z.coerce.number().int().min(0).optional(),
      limit: z.coerce.number().int().min(1).optional(),
    }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.adminCreate": defineHabitatMethod({
    input: createConversationBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tokens.listForSubject": defineHabitatMethod({
    input: z.object({ id: z.coerce.number().int().positive() }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tokens.createForSubject": defineHabitatMethod({
    input: z.object({
      id: z.coerce.number().int().positive(),
      name: z.string().min(1),
    }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tokens.revoke": defineHabitatMethod({
    input: z.object({ id: z.coerce.number().int().positive() }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tts.synthesize": defineHabitatMethod({
    input: ttsSynthesizeInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "POST",
      path: "tts/synthesize",
      response: "raw",
    }),
  }),
} as const;
