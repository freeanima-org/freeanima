import type { z } from "zod";

import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
} from "@freeanima/host/core/db/pg/service-api-token";
import { omitUndefined } from "@freeanima/host/core/util";
import type { HabitatDispatchContext } from "@freeanima/host/platform/habitat/dispatch.ts";
import { habitatMethodDefs } from "@freeanima/shared/habitat-contract/registry/habitat.ts";
import {
  defineHabitatRouteFromDef,
  mergeFeatureRoutes,
  type HabitatRouteHandler,
} from "@freeanima/shared/habitat-contract/route.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import { authHasScope, type ServiceAuthContext } from "../habitat-api/auth-context.ts";
import {
  acpStartAgent,
  acpStartAll,
  acpStopAgent,
  acpStopAll,
  getAcpStatus,
} from "../habitat-api/handlers/acp.ts";
import { listAutoLlmRuns } from "../habitat-api/handlers/auto-llm-runs.ts";
import {
  getHabitatConfig,
  getHabitatConfigSection,
  patchHabitatConfigSection,
  replaceHabitatConfigSection,
} from "../habitat-api/handlers/config.ts";
import { testConfigConnection } from "../habitat-api/handlers/config-test-connection.ts";
import {
  createConversation,
  getConversationInfo,
  getPlatforms,
  listConversations,
} from "../habitat-api/handlers/conversations.ts";
import {
  createSubjectEntity,
  createWorldEntity,
  getSubjectEntity,
  getWorldEntity,
  listSubjectEntities,
  listWorldEntities,
  searchEntities,
  updateSubjectEntity,
  updateWorldEntity,
} from "../habitat-api/handlers/entities.ts";
import { ApiHandlerError } from "../habitat-api/handlers/errors.ts";
import {
  getFtsStatus,
  getRebuildFtsJobStatus,
  startRebuildFtsIndex,
} from "../habitat-api/handlers/fts.ts";
import {
  countSemanticMemory,
  listAutobiographicalMemories,
  listLimbicMemories,
  listMemoryFiles,
  listSemanticMemories,
  memorySearch,
  updateSemanticMemoryPinned,
} from "../habitat-api/handlers/memory.ts";
import { getPromptDebug } from "../habitat-api/handlers/prompt.ts";
import { getOutpostsStatus } from "../habitat-api/handlers/outposts.ts";
import { listSelfBlocks } from "../habitat-api/handlers/self.ts";
import {
  getSleepPipelineStatus,
  getSleepSummary,
  listCronLogs,
  listPipelineStepRuns,
  startSleepCatchUp,
  startSleepCycle,
  startSleepPipelineStep,
} from "../habitat-api/handlers/sleep.ts";
import {
  getHealthProbe,
  getStatus,
  listCronJobs,
  listTools,
  pauseCronJob,
  restartService,
  resumeCronJob,
  runCronJobNow,
} from "../habitat-api/handlers/status.ts";
import {
  getTlsCaInfo,
  getTlsCaPemResponse,
  getTlsCaQrResponse,
} from "../habitat-api/handlers/tls-ca.ts";
import { handleTtsSynthesize } from "../tts-handler.ts";

type AnyHabitatRouteHandler = HabitatRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;

function wrapConsoleLegacyHandler(
  fn: (payload: unknown) => Promise<unknown> | unknown,
): AnyHabitatRouteHandler {
  return (_deps, input, _ctx) => Promise.resolve(fn(input));
}

function requireHttpRequest(ctx: HabitatDispatchContext): Request {
  if (!ctx.httpRequest) {
    throw new Error("public habitat method requires HTTP request context");
  }
  return ctx.httpRequest;
}

function qrRequest(ctx: HabitatDispatchContext, payload: { size?: number }): Request {
  const base = requireHttpRequest(ctx);
  const url = new URL(base.url);
  if (payload.size !== undefined) {
    url.searchParams.set("size", String(payload.size));
  }
  return new Request(url.toString(), base);
}

function requireFullAuth(ctx: unknown): ServiceAuthContext {
  const auth = (ctx as RemoteToolsRequestContext).auth;
  if (!auth || !authHasScope(auth, "full")) {
    throw new ApiHandlerError(403, "full scope required", { code: "scope_forbidden" });
  }
  return auth;
}

const entitySearchHandler: AnyHabitatRouteHandler = (_deps, input, ctx) =>
  Promise.resolve(
    searchEntities(
      input as Parameters<typeof searchEntities>[0],
      (ctx as RemoteToolsRequestContext).auth ?? null,
    ),
  );

export const habitatCoreRoutes = mergeFeatureRoutes([
  defineHabitatRouteFromDef(
    "health.probe",
    habitatMethodDefs["health.probe"],
    (_deps, _input, ctx) =>
      Promise.resolve(getHealthProbe((ctx as HabitatDispatchContext).auth ?? null)),
  ),
  defineHabitatRouteFromDef("tls.ca.info", habitatMethodDefs["tls.ca.info"], (_deps, _input, ctx) =>
    Promise.resolve(getTlsCaInfo(requireHttpRequest(ctx as HabitatDispatchContext))),
  ),
  defineHabitatRouteFromDef(
    "tls.ca.qr",
    habitatMethodDefs["tls.ca.qr"],
    async (_deps, input, ctx) => {
      const res = await getTlsCaQrResponse(
        qrRequest(ctx as HabitatDispatchContext, input as { size?: number }),
      );
      if (!res) {
        throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
      }
      return res;
    },
  ),
  defineHabitatRouteFromDef("tls.ca", habitatMethodDefs["tls.ca"], async () => {
    const res = getTlsCaPemResponse();
    if (!res) {
      throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
    }
    return res;
  }),
  defineHabitatRouteFromDef(
    "status.get",
    habitatMethodDefs["status.get"],
    wrapConsoleLegacyHandler(() => getStatus()),
  ),
  defineHabitatRouteFromDef(
    "status.tools",
    habitatMethodDefs["status.tools"],
    wrapConsoleLegacyHandler((payload) => {
      const { scope } = payload as { scope?: "default" };
      return listTools(scope === "default" ? "default" : undefined);
    }),
  ),
  defineHabitatRouteFromDef(
    "status.platforms",
    habitatMethodDefs["status.platforms"],
    wrapConsoleLegacyHandler(() => getPlatforms()),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobs",
    habitatMethodDefs["status.cronJobs"],
    wrapConsoleLegacyHandler(() => listCronJobs()),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobPause",
    habitatMethodDefs["status.cronJobPause"],
    wrapConsoleLegacyHandler((payload) => pauseCronJob((payload as { id: string }).id)),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobResume",
    habitatMethodDefs["status.cronJobResume"],
    wrapConsoleLegacyHandler((payload) => resumeCronJob((payload as { id: string }).id)),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobRun",
    habitatMethodDefs["status.cronJobRun"],
    wrapConsoleLegacyHandler((payload) => runCronJobNow((payload as { id: string }).id)),
  ),
  defineHabitatRouteFromDef(
    "status.restart",
    habitatMethodDefs["status.restart"],
    wrapConsoleLegacyHandler(() => restartService()),
  ),
  defineHabitatRouteFromDef(
    "config.get",
    habitatMethodDefs["config.get"],
    wrapConsoleLegacyHandler(() => getHabitatConfig()),
  ),
  defineHabitatRouteFromDef(
    "config.getSection",
    habitatMethodDefs["config.getSection"],
    wrapConsoleLegacyHandler((payload) =>
      getHabitatConfigSection((payload as { section: string }).section),
    ),
  ),
  defineHabitatRouteFromDef(
    "config.patchSection",
    habitatMethodDefs["config.patchSection"],
    wrapConsoleLegacyHandler((payload) => {
      const { section, patch } = payload as { section: string; patch: Record<string, unknown> };
      return patchHabitatConfigSection(section, patch);
    }),
  ),
  defineHabitatRouteFromDef(
    "config.replaceSection",
    habitatMethodDefs["config.replaceSection"],
    wrapConsoleLegacyHandler((payload) => {
      const { section, value } = payload as { section: string; value: Record<string, unknown> };
      return replaceHabitatConfigSection(section, value);
    }),
  ),
  defineHabitatRouteFromDef(
    "config.testConnection",
    habitatMethodDefs["config.testConnection"],
    wrapConsoleLegacyHandler((payload) =>
      testConfigConnection(
        payload as {
          service: "firecrawl" | "camofox" | "embedding" | "llm_provider";
          config?: Record<string, unknown>;
          provider_id?: string;
        },
      ),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.files",
    habitatMethodDefs["memory.files"],
    wrapConsoleLegacyHandler(() => listMemoryFiles()),
  ),
  defineHabitatRouteFromDef(
    "memory.search",
    habitatMethodDefs["memory.search"],
    wrapConsoleLegacyHandler((payload) =>
      memorySearch(payload as { query: string; limit?: number }),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.semanticCount",
    habitatMethodDefs["memory.semanticCount"],
    wrapConsoleLegacyHandler(() => countSemanticMemory()),
  ),
  defineHabitatRouteFromDef(
    "memory.semanticList",
    habitatMethodDefs["memory.semanticList"],
    wrapConsoleLegacyHandler((payload) => listSemanticMemories(payload as Record<string, unknown>)),
  ),
  defineHabitatRouteFromDef(
    "memory.semanticPin",
    habitatMethodDefs["memory.semanticPin"],
    wrapConsoleLegacyHandler((payload) =>
      updateSemanticMemoryPinned(payload as { id: number; pinned: boolean }),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.limbicList",
    habitatMethodDefs["memory.limbicList"],
    wrapConsoleLegacyHandler((payload) => listLimbicMemories(payload as Record<string, unknown>)),
  ),
  defineHabitatRouteFromDef(
    "memory.autobiographicalList",
    habitatMethodDefs["memory.autobiographicalList"],
    wrapConsoleLegacyHandler((payload) =>
      listAutobiographicalMemories(payload as Record<string, unknown>),
    ),
  ),
  defineHabitatRouteFromDef(
    "entity.searchGet",
    habitatMethodDefs["entity.searchGet"],
    entitySearchHandler,
  ),
  defineHabitatRouteFromDef(
    "entity.searchPost",
    habitatMethodDefs["entity.searchPost"],
    entitySearchHandler,
  ),
  defineHabitatRouteFromDef(
    "entity.worldsList",
    habitatMethodDefs["entity.worldsList"],
    wrapConsoleLegacyHandler((payload) => listWorldEntities(payload as Record<string, unknown>)),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsCreate",
    habitatMethodDefs["entity.worldsCreate"],
    wrapConsoleLegacyHandler((payload) =>
      createWorldEntity(payload as Parameters<typeof createWorldEntity>[0]),
    ),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsGet",
    habitatMethodDefs["entity.worldsGet"],
    wrapConsoleLegacyHandler((payload) => getWorldEntity(Number((payload as { id: string }).id))),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsPatch",
    habitatMethodDefs["entity.worldsPatch"],
    wrapConsoleLegacyHandler((payload) => {
      const { id, ...body } = payload as Record<string, unknown> & { id: string };
      return updateWorldEntity(Number(id), body);
    }),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsList",
    habitatMethodDefs["entity.subjectsList"],
    wrapConsoleLegacyHandler((payload) => listSubjectEntities(payload as Record<string, unknown>)),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsCreate",
    habitatMethodDefs["entity.subjectsCreate"],
    wrapConsoleLegacyHandler((payload) =>
      createSubjectEntity(payload as Parameters<typeof createSubjectEntity>[0]),
    ),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsGet",
    habitatMethodDefs["entity.subjectsGet"],
    wrapConsoleLegacyHandler((payload) => getSubjectEntity(Number((payload as { id: string }).id))),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsPatch",
    habitatMethodDefs["entity.subjectsPatch"],
    wrapConsoleLegacyHandler((payload) => {
      const { id, ...body } = payload as Record<string, unknown> & { id: string };
      return updateSubjectEntity(Number(id), body);
    }),
  ),
  defineHabitatRouteFromDef(
    "self.blocks",
    habitatMethodDefs["self.blocks"],
    wrapConsoleLegacyHandler(() => listSelfBlocks()),
  ),
  defineHabitatRouteFromDef(
    "prompt.debug",
    habitatMethodDefs["prompt.debug"],
    wrapConsoleLegacyHandler((payload) =>
      getPromptDebug((payload as { conversation_id?: string }).conversation_id),
    ),
  ),
  defineHabitatRouteFromDef(
    "outposts.status",
    habitatMethodDefs["outposts.status"],
    wrapConsoleLegacyHandler(() => getOutpostsStatus()),
  ),
  defineHabitatRouteFromDef(
    "acp.status",
    habitatMethodDefs["acp.status"],
    wrapConsoleLegacyHandler(() => getAcpStatus()),
  ),
  defineHabitatRouteFromDef(
    "acp.startAll",
    habitatMethodDefs["acp.startAll"],
    wrapConsoleLegacyHandler(() => acpStartAll()),
  ),
  defineHabitatRouteFromDef(
    "acp.stopAll",
    habitatMethodDefs["acp.stopAll"],
    wrapConsoleLegacyHandler(() => acpStopAll()),
  ),
  defineHabitatRouteFromDef(
    "acp.startAgent",
    habitatMethodDefs["acp.startAgent"],
    wrapConsoleLegacyHandler((payload) => acpStartAgent((payload as { name: string }).name)),
  ),
  defineHabitatRouteFromDef(
    "acp.stopAgent",
    habitatMethodDefs["acp.stopAgent"],
    wrapConsoleLegacyHandler((payload) => acpStopAgent((payload as { name: string }).name)),
  ),
  defineHabitatRouteFromDef(
    "fts.status",
    habitatMethodDefs["fts.status"],
    wrapConsoleLegacyHandler(() => getFtsStatus()),
  ),
  defineHabitatRouteFromDef(
    "fts.rebuildStatus",
    habitatMethodDefs["fts.rebuildStatus"],
    wrapConsoleLegacyHandler(() => getRebuildFtsJobStatus()),
  ),
  defineHabitatRouteFromDef(
    "fts.rebuild",
    habitatMethodDefs["fts.rebuild"],
    wrapConsoleLegacyHandler((payload) =>
      startRebuildFtsIndex(
        omitUndefined({ onlyMissing: (payload as { only_missing?: boolean }).only_missing }),
      ),
    ),
  ),
  defineHabitatRouteFromDef(
    "sleep.summary",
    habitatMethodDefs["sleep.summary"],
    wrapConsoleLegacyHandler(() => getSleepSummary()),
  ),
  defineHabitatRouteFromDef(
    "sleep.pipelineRuns",
    habitatMethodDefs["sleep.pipelineRuns"],
    wrapConsoleLegacyHandler((payload) =>
      listPipelineStepRuns(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHabitatRouteFromDef(
    "sleep.pipelineStatus",
    habitatMethodDefs["sleep.pipelineStatus"],
    wrapConsoleLegacyHandler(() => getSleepPipelineStatus()),
  ),
  defineHabitatRouteFromDef(
    "sleep.runPipelineStep",
    habitatMethodDefs["sleep.runPipelineStep"],
    wrapConsoleLegacyHandler((payload) =>
      startSleepPipelineStep(
        omitUndefined(
          payload as {
            step_id: string;
            day?: string;
            force?: boolean;
            deep_sleep_mode?: "full" | "incremental";
          },
        ),
      ),
    ),
  ),
  defineHabitatRouteFromDef(
    "sleep.startCycle",
    habitatMethodDefs["sleep.startCycle"],
    wrapConsoleLegacyHandler((payload) =>
      startSleepCycle(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHabitatRouteFromDef(
    "sleep.startCatchUp",
    habitatMethodDefs["sleep.startCatchUp"],
    wrapConsoleLegacyHandler(() => startSleepCatchUp()),
  ),
  defineHabitatRouteFromDef(
    "cronLogs.list",
    habitatMethodDefs["cronLogs.list"],
    wrapConsoleLegacyHandler((payload) =>
      listCronLogs(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHabitatRouteFromDef(
    "autoLlmRuns.list",
    habitatMethodDefs["autoLlmRuns.list"],
    wrapConsoleLegacyHandler((payload) =>
      listAutoLlmRuns(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHabitatRouteFromDef(
    "worlds.context",
    habitatMethodDefs["worlds.context"],
    wrapConsoleLegacyHandler(() => getResolvedWorldContext()),
  ),
  defineHabitatRouteFromDef(
    "conversation.adminGet",
    habitatMethodDefs["conversation.adminGet"],
    wrapConsoleLegacyHandler((payload) =>
      getConversationInfo((payload as { conversationId: string }).conversationId),
    ),
  ),
  defineHabitatRouteFromDef(
    "conversation.adminListAll",
    habitatMethodDefs["conversation.adminListAll"],
    wrapConsoleLegacyHandler((payload) => {
      const { offset, limit } = payload as { offset?: number; limit?: number };
      return listConversations(
        undefined,
        omitUndefined({
          offset: offset ?? 0,
          limit: limit ?? 10_000,
        }),
      );
    }),
  ),
  defineHabitatRouteFromDef(
    "conversation.adminCreate",
    habitatMethodDefs["conversation.adminCreate"],
    wrapConsoleLegacyHandler((payload) => createConversation(payload as { platform: string })),
  ),
  defineHabitatRouteFromDef(
    "tokens.listForSubject",
    habitatMethodDefs["tokens.listForSubject"],
    async (_deps, payload, ctx) => {
      requireFullAuth(ctx);
      const { id } = payload as { id: number };
      await getSubjectEntity(id);
      const items = await listServiceApiTokensBySubject(id);
      return { items };
    },
  ),
  defineHabitatRouteFromDef(
    "tokens.createForSubject",
    habitatMethodDefs["tokens.createForSubject"],
    async (_deps, payload, ctx) => {
      requireFullAuth(ctx);
      const { id, name } = payload as { id: number; name: string };
      await getSubjectEntity(id);
      const trimmed = name.trim();
      if (!trimmed) {
        throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
      }
      const result = await createServiceApiTokenWithSecret({
        subject_id: id,
        name: trimmed,
      });
      return { token: result.token, plaintext: result.plaintext };
    },
  ),
  defineHabitatRouteFromDef(
    "tokens.revoke",
    habitatMethodDefs["tokens.revoke"],
    async (_deps, payload, ctx) => {
      requireFullAuth(ctx);
      const { id } = payload as { id: number };
      const row = await getServiceApiTokenById(id);
      if (!row) {
        throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
      }
      const ok = await revokeServiceApiToken(id);
      if (!ok) {
        throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
      }
      return { ok: true as const };
    },
  ),
  defineHabitatRouteFromDef(
    "tts.synthesize",
    habitatMethodDefs["tts.synthesize"],
    handleTtsSynthesize as AnyHabitatRouteHandler,
  ),
]);
