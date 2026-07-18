import type { z } from "zod";

import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
} from "@freeanima/core/db/pg/service-api-token";
import { omitUndefined } from "@freeanima/core/util";
import type { HubDispatchContext } from "@freeanima/platform/hub/dispatch.ts";
import { consoleMethodDefs } from "@freeanima/shared/hub-contract/registry/console.ts";
import {
  defineHubRouteFromDef,
  mergeFeatureRoutes,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";

import { authHasScope, type ServiceAuthContext } from "../console-api/auth-context.ts";
import {
  acpStartAgent,
  acpStartAll,
  acpStopAgent,
  acpStopAll,
  getAcpStatus,
} from "../console-api/handlers/acp.ts";
import { listAutoLlmRuns } from "../console-api/handlers/auto-llm-runs.ts";
import {
  getHubConfig,
  getHubConfigSection,
  patchHubConfigSection,
  replaceHubConfigSection,
} from "../console-api/handlers/config.ts";
import { testConfigConnection } from "../console-api/handlers/config-test-connection.ts";
import {
  createConversation,
  getConversationInfo,
  getPlatforms,
  listConversations,
} from "../console-api/handlers/conversations.ts";
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
} from "../console-api/handlers/entities.ts";
import { ApiHandlerError } from "../console-api/handlers/errors.ts";
import {
  getFtsStatus,
  getRebuildFtsJobStatus,
  startRebuildFtsIndex,
} from "../console-api/handlers/fts.ts";
import {
  countSemanticMemory,
  listAutobiographicalMemories,
  listLimbicMemories,
  listMemoryFiles,
  listSemanticMemories,
  memorySearch,
  updateSemanticMemoryPinned,
} from "../console-api/handlers/memory.ts";
import { getPromptDebug } from "../console-api/handlers/prompt.ts";
import { getSatellitesStatus } from "../console-api/handlers/satellites.ts";
import { listSelfBlocks } from "../console-api/handlers/self.ts";
import {
  getDeepSleepRounds,
  getSleepPipelineStatus,
  getSleepSummary,
  listCronLogs,
  listPipelineStepRuns,
  startSleepCycle,
  startSleepPipelineStep,
} from "../console-api/handlers/sleep.ts";
import {
  getHealthProbe,
  getStatus,
  listCronJobs,
  listTools,
  pauseCronJob,
  restartService,
  resumeCronJob,
  runCronJobNow,
} from "../console-api/handlers/status.ts";
import {
  getTlsCaInfo,
  getTlsCaPemResponse,
  getTlsCaQrResponse,
} from "../console-api/handlers/tls-ca.ts";
import { handleTtsSynthesize } from "../tts-handler.ts";

type AnyHubRouteHandler = HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;

function wrapConsoleLegacyHandler(
  fn: (payload: unknown) => Promise<unknown> | unknown,
): AnyHubRouteHandler {
  return (_deps, input, _ctx) => Promise.resolve(fn(input));
}

function requireHttpRequest(ctx: HubDispatchContext): Request {
  if (!ctx.httpRequest) {
    throw new Error("public hub method requires HTTP request context");
  }
  return ctx.httpRequest;
}

function qrRequest(ctx: HubDispatchContext, payload: { size?: number }): Request {
  const base = requireHttpRequest(ctx);
  const url = new URL(base.url);
  if (payload.size !== undefined) {
    url.searchParams.set("size", String(payload.size));
  }
  return new Request(url.toString(), base);
}

function requireFullAuth(ctx: unknown): ServiceAuthContext {
  const auth = (ctx as SapRequestContext).auth;
  if (!auth || !authHasScope(auth, "full")) {
    throw new ApiHandlerError(403, "full scope required", { code: "scope_forbidden" });
  }
  return auth;
}

const entitySearchHandler: AnyHubRouteHandler = (_deps, input, ctx) =>
  Promise.resolve(
    searchEntities(
      input as Parameters<typeof searchEntities>[0],
      (ctx as SapRequestContext).auth ?? null,
    ),
  );

export const consoleHubRoutes = mergeFeatureRoutes([
  defineHubRouteFromDef("health.probe", consoleMethodDefs["health.probe"], (_deps, _input, ctx) =>
    Promise.resolve(getHealthProbe((ctx as HubDispatchContext).auth ?? null)),
  ),
  defineHubRouteFromDef("tls.ca.info", consoleMethodDefs["tls.ca.info"], (_deps, _input, ctx) =>
    Promise.resolve(getTlsCaInfo(requireHttpRequest(ctx as HubDispatchContext))),
  ),
  defineHubRouteFromDef("tls.ca.qr", consoleMethodDefs["tls.ca.qr"], async (_deps, input, ctx) => {
    const res = await getTlsCaQrResponse(
      qrRequest(ctx as HubDispatchContext, input as { size?: number }),
    );
    if (!res) {
      throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
    }
    return res;
  }),
  defineHubRouteFromDef("tls.ca", consoleMethodDefs["tls.ca"], async () => {
    const res = getTlsCaPemResponse();
    if (!res) {
      throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
    }
    return res;
  }),
  defineHubRouteFromDef(
    "status.get",
    consoleMethodDefs["status.get"],
    wrapConsoleLegacyHandler(() => getStatus()),
  ),
  defineHubRouteFromDef(
    "status.tools",
    consoleMethodDefs["status.tools"],
    wrapConsoleLegacyHandler((payload) => {
      const { scope } = payload as { scope?: "default" };
      return listTools(scope === "default" ? "default" : undefined);
    }),
  ),
  defineHubRouteFromDef(
    "status.platforms",
    consoleMethodDefs["status.platforms"],
    wrapConsoleLegacyHandler(() => getPlatforms()),
  ),
  defineHubRouteFromDef(
    "status.cronJobs",
    consoleMethodDefs["status.cronJobs"],
    wrapConsoleLegacyHandler(() => listCronJobs()),
  ),
  defineHubRouteFromDef(
    "status.cronJobPause",
    consoleMethodDefs["status.cronJobPause"],
    wrapConsoleLegacyHandler((payload) => pauseCronJob((payload as { id: string }).id)),
  ),
  defineHubRouteFromDef(
    "status.cronJobResume",
    consoleMethodDefs["status.cronJobResume"],
    wrapConsoleLegacyHandler((payload) => resumeCronJob((payload as { id: string }).id)),
  ),
  defineHubRouteFromDef(
    "status.cronJobRun",
    consoleMethodDefs["status.cronJobRun"],
    wrapConsoleLegacyHandler((payload) => runCronJobNow((payload as { id: string }).id)),
  ),
  defineHubRouteFromDef(
    "status.restart",
    consoleMethodDefs["status.restart"],
    wrapConsoleLegacyHandler(() => restartService()),
  ),
  defineHubRouteFromDef(
    "config.get",
    consoleMethodDefs["config.get"],
    wrapConsoleLegacyHandler(() => getHubConfig()),
  ),
  defineHubRouteFromDef(
    "config.getSection",
    consoleMethodDefs["config.getSection"],
    wrapConsoleLegacyHandler((payload) =>
      getHubConfigSection((payload as { section: string }).section),
    ),
  ),
  defineHubRouteFromDef(
    "config.patchSection",
    consoleMethodDefs["config.patchSection"],
    wrapConsoleLegacyHandler((payload) => {
      const { section, patch } = payload as { section: string; patch: Record<string, unknown> };
      return patchHubConfigSection(section, patch);
    }),
  ),
  defineHubRouteFromDef(
    "config.replaceSection",
    consoleMethodDefs["config.replaceSection"],
    wrapConsoleLegacyHandler((payload) => {
      const { section, value } = payload as { section: string; value: Record<string, unknown> };
      return replaceHubConfigSection(section, value);
    }),
  ),
  defineHubRouteFromDef(
    "config.testConnection",
    consoleMethodDefs["config.testConnection"],
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
  defineHubRouteFromDef(
    "memory.files",
    consoleMethodDefs["memory.files"],
    wrapConsoleLegacyHandler(() => listMemoryFiles()),
  ),
  defineHubRouteFromDef(
    "memory.search",
    consoleMethodDefs["memory.search"],
    wrapConsoleLegacyHandler((payload) =>
      memorySearch(payload as { query: string; limit?: number }),
    ),
  ),
  defineHubRouteFromDef(
    "memory.semanticCount",
    consoleMethodDefs["memory.semanticCount"],
    wrapConsoleLegacyHandler(() => countSemanticMemory()),
  ),
  defineHubRouteFromDef(
    "memory.semanticList",
    consoleMethodDefs["memory.semanticList"],
    wrapConsoleLegacyHandler((payload) => listSemanticMemories(payload as Record<string, unknown>)),
  ),
  defineHubRouteFromDef(
    "memory.semanticPin",
    consoleMethodDefs["memory.semanticPin"],
    wrapConsoleLegacyHandler((payload) =>
      updateSemanticMemoryPinned(payload as { id: number; pinned: boolean }),
    ),
  ),
  defineHubRouteFromDef(
    "memory.limbicList",
    consoleMethodDefs["memory.limbicList"],
    wrapConsoleLegacyHandler((payload) => listLimbicMemories(payload as Record<string, unknown>)),
  ),
  defineHubRouteFromDef(
    "memory.autobiographicalList",
    consoleMethodDefs["memory.autobiographicalList"],
    wrapConsoleLegacyHandler((payload) =>
      listAutobiographicalMemories(payload as Record<string, unknown>),
    ),
  ),
  defineHubRouteFromDef(
    "entity.searchGet",
    consoleMethodDefs["entity.searchGet"],
    entitySearchHandler,
  ),
  defineHubRouteFromDef(
    "entity.searchPost",
    consoleMethodDefs["entity.searchPost"],
    entitySearchHandler,
  ),
  defineHubRouteFromDef(
    "entity.worldsList",
    consoleMethodDefs["entity.worldsList"],
    wrapConsoleLegacyHandler((payload) => listWorldEntities(payload as Record<string, unknown>)),
  ),
  defineHubRouteFromDef(
    "entity.worldsCreate",
    consoleMethodDefs["entity.worldsCreate"],
    wrapConsoleLegacyHandler((payload) =>
      createWorldEntity(payload as Parameters<typeof createWorldEntity>[0]),
    ),
  ),
  defineHubRouteFromDef(
    "entity.worldsGet",
    consoleMethodDefs["entity.worldsGet"],
    wrapConsoleLegacyHandler((payload) => getWorldEntity(Number((payload as { id: string }).id))),
  ),
  defineHubRouteFromDef(
    "entity.worldsPatch",
    consoleMethodDefs["entity.worldsPatch"],
    wrapConsoleLegacyHandler((payload) => {
      const { id, ...body } = payload as Record<string, unknown> & { id: string };
      return updateWorldEntity(Number(id), body);
    }),
  ),
  defineHubRouteFromDef(
    "entity.subjectsList",
    consoleMethodDefs["entity.subjectsList"],
    wrapConsoleLegacyHandler((payload) => listSubjectEntities(payload as Record<string, unknown>)),
  ),
  defineHubRouteFromDef(
    "entity.subjectsCreate",
    consoleMethodDefs["entity.subjectsCreate"],
    wrapConsoleLegacyHandler((payload) =>
      createSubjectEntity(payload as Parameters<typeof createSubjectEntity>[0]),
    ),
  ),
  defineHubRouteFromDef(
    "entity.subjectsGet",
    consoleMethodDefs["entity.subjectsGet"],
    wrapConsoleLegacyHandler((payload) => getSubjectEntity(Number((payload as { id: string }).id))),
  ),
  defineHubRouteFromDef(
    "entity.subjectsPatch",
    consoleMethodDefs["entity.subjectsPatch"],
    wrapConsoleLegacyHandler((payload) => {
      const { id, ...body } = payload as Record<string, unknown> & { id: string };
      return updateSubjectEntity(Number(id), body);
    }),
  ),
  defineHubRouteFromDef(
    "self.blocks",
    consoleMethodDefs["self.blocks"],
    wrapConsoleLegacyHandler(() => listSelfBlocks()),
  ),
  defineHubRouteFromDef(
    "prompt.debug",
    consoleMethodDefs["prompt.debug"],
    wrapConsoleLegacyHandler((payload) =>
      getPromptDebug((payload as { conversation_id?: string }).conversation_id),
    ),
  ),
  defineHubRouteFromDef(
    "src/satellites.status",
    consoleMethodDefs["src/satellites.status"],
    wrapConsoleLegacyHandler(() => getSatellitesStatus()),
  ),
  defineHubRouteFromDef(
    "acp.status",
    consoleMethodDefs["acp.status"],
    wrapConsoleLegacyHandler(() => getAcpStatus()),
  ),
  defineHubRouteFromDef(
    "acp.startAll",
    consoleMethodDefs["acp.startAll"],
    wrapConsoleLegacyHandler(() => acpStartAll()),
  ),
  defineHubRouteFromDef(
    "acp.stopAll",
    consoleMethodDefs["acp.stopAll"],
    wrapConsoleLegacyHandler(() => acpStopAll()),
  ),
  defineHubRouteFromDef(
    "acp.startAgent",
    consoleMethodDefs["acp.startAgent"],
    wrapConsoleLegacyHandler((payload) => acpStartAgent((payload as { name: string }).name)),
  ),
  defineHubRouteFromDef(
    "acp.stopAgent",
    consoleMethodDefs["acp.stopAgent"],
    wrapConsoleLegacyHandler((payload) => acpStopAgent((payload as { name: string }).name)),
  ),
  defineHubRouteFromDef(
    "fts.status",
    consoleMethodDefs["fts.status"],
    wrapConsoleLegacyHandler(() => getFtsStatus()),
  ),
  defineHubRouteFromDef(
    "fts.rebuildStatus",
    consoleMethodDefs["fts.rebuildStatus"],
    wrapConsoleLegacyHandler(() => getRebuildFtsJobStatus()),
  ),
  defineHubRouteFromDef(
    "fts.rebuild",
    consoleMethodDefs["fts.rebuild"],
    wrapConsoleLegacyHandler((payload) =>
      startRebuildFtsIndex(
        omitUndefined({ onlyMissing: (payload as { only_missing?: boolean }).only_missing }),
      ),
    ),
  ),
  defineHubRouteFromDef(
    "sleep.summary",
    consoleMethodDefs["sleep.summary"],
    wrapConsoleLegacyHandler(() => getSleepSummary()),
  ),
  defineHubRouteFromDef(
    "sleep.pipelineRuns",
    consoleMethodDefs["sleep.pipelineRuns"],
    wrapConsoleLegacyHandler((payload) =>
      listPipelineStepRuns(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHubRouteFromDef(
    "sleep.deepSleepRounds",
    consoleMethodDefs["sleep.deepSleepRounds"],
    wrapConsoleLegacyHandler((payload) => getDeepSleepRounds((payload as { day: string }).day)),
  ),
  defineHubRouteFromDef(
    "sleep.pipelineStatus",
    consoleMethodDefs["sleep.pipelineStatus"],
    wrapConsoleLegacyHandler(() => getSleepPipelineStatus()),
  ),
  defineHubRouteFromDef(
    "sleep.runPipelineStep",
    consoleMethodDefs["sleep.runPipelineStep"],
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
  defineHubRouteFromDef(
    "sleep.startCycle",
    consoleMethodDefs["sleep.startCycle"],
    wrapConsoleLegacyHandler((payload) =>
      startSleepCycle(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHubRouteFromDef(
    "cronLogs.list",
    consoleMethodDefs["cronLogs.list"],
    wrapConsoleLegacyHandler((payload) =>
      listCronLogs(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHubRouteFromDef(
    "autoLlmRuns.list",
    consoleMethodDefs["autoLlmRuns.list"],
    wrapConsoleLegacyHandler((payload) =>
      listAutoLlmRuns(omitUndefined(payload as Record<string, unknown>)),
    ),
  ),
  defineHubRouteFromDef(
    "worlds.context",
    consoleMethodDefs["worlds.context"],
    wrapConsoleLegacyHandler(() => getResolvedWorldContext()),
  ),
  defineHubRouteFromDef(
    "conversation.adminGet",
    consoleMethodDefs["conversation.adminGet"],
    wrapConsoleLegacyHandler((payload) =>
      getConversationInfo((payload as { conversationId: string }).conversationId),
    ),
  ),
  defineHubRouteFromDef(
    "conversation.adminListAll",
    consoleMethodDefs["conversation.adminListAll"],
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
  defineHubRouteFromDef(
    "conversation.adminCreate",
    consoleMethodDefs["conversation.adminCreate"],
    wrapConsoleLegacyHandler((payload) => createConversation(payload as { platform: string })),
  ),
  defineHubRouteFromDef(
    "tokens.listForSubject",
    consoleMethodDefs["tokens.listForSubject"],
    async (_deps, payload, ctx) => {
      requireFullAuth(ctx);
      const { id } = payload as { id: number };
      await getSubjectEntity(id);
      const items = await listServiceApiTokensBySubject(id);
      return { items };
    },
  ),
  defineHubRouteFromDef(
    "tokens.createForSubject",
    consoleMethodDefs["tokens.createForSubject"],
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
  defineHubRouteFromDef(
    "tokens.revoke",
    consoleMethodDefs["tokens.revoke"],
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
  defineHubRouteFromDef(
    "tts.synthesize",
    consoleMethodDefs["tts.synthesize"],
    handleTtsSynthesize as AnyHubRouteHandler,
  ),
]);
