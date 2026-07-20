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
  defineHubMethod,
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

/** Console 运维面 HTTP-only methods（conversation.* dual 定义在 chat registry） */
export const consoleMethodDefs = {
  "health.probe": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: publicHttpMeta(),
  }),
  "tls.ca.info": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: publicHttpMeta(),
  }),
  "tls.ca.qr": defineHubMethod({
    input: tlsCaQrInputSchema,
    output: unknownOutputSchema,
    meta: rawPublicHttpMeta(),
  }),
  "tls.ca": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: rawPublicHttpMeta(),
  }),
  "status.get": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.tools": defineHubMethod({
    input: toolsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.platforms": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.cronJobs": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "status.cronJobPause": defineHubMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "status.cronJobResume": defineHubMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "status.cronJobRun": defineHubMethod({
    input: cronJobIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "status.restart": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "config.get": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "config.getSection": defineHubMethod({
    input: configSectionParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "config.patchSection": defineHubMethod({
    input: configSectionParamSchema.extend({ patch: z.record(z.string(), z.unknown()) }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "config.replaceSection": defineHubMethod({
    input: configSectionParamSchema.extend({ value: z.record(z.string(), z.unknown()) }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "config.testConnection": defineHubMethod({
    input: configTestConnectionInputSchema,
    output: configTestConnectionOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.files": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "memory.search": defineHubMethod({
    input: memorySearchBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.semanticCount": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.semanticList": defineHubMethod({
    input: semanticMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.semanticPin": defineHubMethod({
    input: semanticMemoryPinBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.limbicList": defineHubMethod({
    input: limbicMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "memory.autobiographicalList": defineHubMethod({
    input: autobiographicalMemoryListBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.searchGet": defineHubMethod({
    input: entitySearchQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.searchPost": defineHubMethod({
    input: entitySearchBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.worldsList": defineHubMethod({
    input: entityListQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.worldsCreate": defineHubMethod({
    input: worldEntityCreateBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.worldsGet": defineHubMethod({
    input: idParamInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.worldsPatch": defineHubMethod({
    input: worldEntityPatchInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.subjectsList": defineHubMethod({
    input: entityListQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.subjectsCreate": defineHubMethod({
    input: subjectEntityCreateBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.subjectsGet": defineHubMethod({
    input: idParamInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.subjectsPatch": defineHubMethod({
    input: z.object({ id: z.string().min(1) }).passthrough(),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "self.blocks": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "prompt.debug": defineHubMethod({
    input: promptDebugQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "src/satellites.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "acp.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "acp.startAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "acp.stopAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "acp.startAgent": defineHubMethod({
    input: nameParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "acp.stopAgent": defineHubMethod({
    input: nameParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "fts.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "fts.rebuildStatus": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "fts.rebuild": defineHubMethod({
    input: ftsRebuildBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "sleep.summary": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "sleep.pipelineRuns": defineHubMethod({
    input: pipelineRunsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "sleep.pipelineStatus": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "sleep.runPipelineStep": defineHubMethod({
    input: sleepRunStepBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "sleep.startCycle": defineHubMethod({
    input: sleepCycleBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "cronLogs.list": defineHubMethod({
    input: cronLogsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "autoLlmRuns.list": defineHubMethod({
    input: autoLlmRunsQuerySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "worlds.context": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.adminGet": defineHubMethod({
    input: conversationIdParamSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.adminListAll": defineHubMethod({
    input: z.object({
      offset: z.coerce.number().int().min(0).optional(),
      limit: z.coerce.number().int().min(1).optional(),
    }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.adminCreate": defineHubMethod({
    input: createConversationBodySchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tokens.listForSubject": defineHubMethod({
    input: z.object({ id: z.coerce.number().int().positive() }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tokens.createForSubject": defineHubMethod({
    input: z.object({
      id: z.coerce.number().int().positive(),
      name: z.string().min(1),
    }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tokens.revoke": defineHubMethod({
    input: z.object({ id: z.coerce.number().int().positive() }),
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tts.synthesize": defineHubMethod({
    input: ttsSynthesizeInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "POST",
      path: "tts/synthesize",
      response: "raw",
    }),
  }),
} as const;
