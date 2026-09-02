import type { z } from "zod";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revealServiceApiTokenPlaintext,
  revokeServiceApiToken,
  updateServiceApiTokenName,
} from "@freeanima/habitat/core/db/pg/service-api-token";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { HabitatDispatchContext } from "@freeanima/habitat/platform/habitat/dispatch.ts";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types.ts";
import { habitatMethodDefs } from "@freeanima/shared/habitat-contract/registry/habitat.ts";
import {
  asRouteCtx,
  asRouteDeps,
  defineHabitatRouteFromDef,
  mergeFeatureRoutes,
  type HabitatRouteHandler,
} from "@freeanima/shared/habitat-contract/route.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  expandTokenPreset,
  FULL_TOKEN_AUTHORIZATION,
  parseServiceApiTokenAuthorization,
} from "@freeanima/shared/service-api-auth";
import { isRecord } from "@freeanima/shared/util";

import { authHasScope, type ServiceAuthContext } from "../habitat-api/auth-context.ts";
import { listAutoLlmRuns, getAutoLlmRun } from "../habitat-api/handlers/auto-llm-runs.ts";
import { getUsageToday } from "../habitat-api/handlers/llm-usage.ts";
import {
  getHabitatConfig,
  getHabitatConfigSection,
  patchHabitatConfigSection,
  replaceHabitatConfigSection,
} from "../habitat-api/handlers/config.ts";
import { testConfigConnection } from "../habitat-api/handlers/config-test-connection.ts";
import { listProviderModels } from "../habitat-api/handlers/config-list-provider-models.ts";
import { listProviderVoices } from "../habitat-api/handlers/config-list-provider-voices.ts";
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
  deleteHabitatRedisLock,
  listHabitatRedisLocks,
} from "../habitat-api/handlers/redis-locks.ts";
import { runDataIntegrityCheck } from "../habitat-api/handlers/data-integrity.ts";
import {
  countSemanticMemory,
  listSemanticMemories,
  listSemanticMemoryClusters,
  listTemporalSummaries,
  regenerateTemporalSummary,
  backfillMissingTemporalSummaries,
  rebuildTemporalSummariesInRange,
  getTemporalBatchJobStatus,
  listTemporalSystemRolls,
  regenerateTemporalSystemRoll,
  startTemporalSystemRollBatch,
  getTemporalSystemRollBatchStatus,
  passiveRecallDebug,
  updateSemanticMemoryPinned,
} from "../habitat-api/handlers/memory.ts";
import { getPromptDebug } from "../habitat-api/handlers/prompt.ts";
import { getOutpostsStatus } from "../habitat-api/handlers/outposts.ts";
import { listSelfBlocks } from "../habitat-api/handlers/self.ts";
import { getHabitatSkill, listHabitatSkills } from "../habitat-api/handlers/skills.ts";
import {
  getMemoryMaintenanceStatus,
  getMemoryMaintenanceSummary,
  listCronLogs,
  startMemoryMaintenanceCatchUp,
  startMemoryMaintenanceCycle,
  startMemoryMaintenanceStep,
} from "../habitat-api/handlers/memory-maintenance.ts";
import {
  getHealthProbe,
  getStatus,
  listCronJobs,
  listTools,
  pauseCronJob,
  restartService,
  resumeCronJob,
  runCronJobNow,
  createCronJob,
  deleteCronJob,
  checkServiceUpdateStatus,
  applyServiceUpdateStatus,
} from "../habitat-api/handlers/status.ts";
import {
  getTlsCaInfo,
  getTlsCaPemResponse,
  getTlsCaQrResponse,
} from "../habitat-api/handlers/tls-ca.ts";
import { handleTtsSynthesize } from "../tts-handler.ts";
import { handleAsrTranscribe } from "../asr-handler.ts";

/** 将返回 Response / unknown 的实现接到具体 HabitatRouteHandler（Zod4 ZodTypeAny≠any） */
function asLooseRouteHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  _def: { input: I; output: O },
  handler: (deps: unknown, input: z.infer<I>, ctx: unknown) => Promise<unknown>,
): HabitatRouteHandler<I, O> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- raw Response / unknownOutput 边界
  return handler as HabitatRouteHandler<I, O>;
}

function requireDispatchCtx(ctx: unknown): HabitatDispatchContext {
  if (!isRecord(ctx)) {
    throw new Error("invalid habitat dispatch context");
  }
  if (typeof ctx.app_id !== "string" || typeof ctx.instance_id !== "string") {
    throw new Error("invalid habitat dispatch context");
  }
  if (typeof ctx.sendEvent !== "function") {
    throw new Error("invalid habitat dispatch context");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- dispatch ctx 由 router 注入
  return ctx as HabitatDispatchContext;
}

function requireRemoteToolsCtx(ctx: unknown): RemoteToolsRequestContext {
  return requireDispatchCtx(ctx);
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
  const auth = requireRemoteToolsCtx(ctx).auth;
  if (!auth || !authHasScope(auth, "full")) {
    throw new ApiHandlerError(403, "full scope required", { code: "scope_forbidden" });
  }
  return auth;
}

export const habitatCoreRoutes = mergeFeatureRoutes([
  defineHabitatRouteFromDef(
    "health.probe",
    habitatMethodDefs["health.probe"],
    (_deps, _input, ctx) => Promise.resolve(getHealthProbe(requireDispatchCtx(ctx).auth ?? null)),
  ),
  defineHabitatRouteFromDef("tls.ca.info", habitatMethodDefs["tls.ca.info"], (_deps, _input, ctx) =>
    Promise.resolve(getTlsCaInfo(requireHttpRequest(requireDispatchCtx(ctx)))),
  ),
  defineHabitatRouteFromDef(
    "tls.ca.qr",
    habitatMethodDefs["tls.ca.qr"],
    // raw PNG Response（http-rest-router 识别 Response，非 JSON Record）
    asLooseRouteHandler(habitatMethodDefs["tls.ca.qr"], async (_deps, input, ctx) => {
      const res = await getTlsCaQrResponse(
        qrRequest(requireDispatchCtx(ctx), omitUndefined(input)),
      );
      if (!res) {
        throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
      }
      return res;
    }),
  ),
  defineHabitatRouteFromDef(
    "tls.ca",
    habitatMethodDefs["tls.ca"],
    // raw PEM Response
    asLooseRouteHandler(habitatMethodDefs["tls.ca"], async () => {
      const res = getTlsCaPemResponse();
      if (!res) {
        throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
      }
      return res;
    }),
  ),
  defineHabitatRouteFromDef("status.get", habitatMethodDefs["status.get"], () =>
    Promise.resolve(getStatus()),
  ),
  defineHabitatRouteFromDef(
    "status.tools",
    habitatMethodDefs["status.tools"],
    asLooseRouteHandler(habitatMethodDefs["status.tools"], (_deps, input) =>
      Promise.resolve(listTools(input.scope === "default" ? "default" : undefined)),
    ),
  ),
  defineHabitatRouteFromDef("status.platforms", habitatMethodDefs["status.platforms"], () =>
    Promise.resolve(getPlatforms()),
  ),
  defineHabitatRouteFromDef("status.cronJobs", habitatMethodDefs["status.cronJobs"], () =>
    Promise.resolve(listCronJobs()),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobPause",
    habitatMethodDefs["status.cronJobPause"],
    (_deps, input) => Promise.resolve(pauseCronJob(input.id)),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobResume",
    habitatMethodDefs["status.cronJobResume"],
    (_deps, input) => Promise.resolve(resumeCronJob(input.id)),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobRun",
    habitatMethodDefs["status.cronJobRun"],
    (_deps, input) => Promise.resolve(runCronJobNow(input.id)),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobCreate",
    habitatMethodDefs["status.cronJobCreate"],
    (_deps, input) => Promise.resolve(createCronJob(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "status.cronJobDelete",
    habitatMethodDefs["status.cronJobDelete"],
    (_deps, input) => Promise.resolve(deleteCronJob(input.id)),
  ),
  defineHabitatRouteFromDef("status.restart", habitatMethodDefs["status.restart"], () =>
    Promise.resolve(restartService()),
  ),
  defineHabitatRouteFromDef(
    "status.updateCheck",
    habitatMethodDefs["status.updateCheck"],
    (_deps, input) => Promise.resolve(checkServiceUpdateStatus(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "status.updateApply",
    habitatMethodDefs["status.updateApply"],
    (_deps, input) => Promise.resolve(applyServiceUpdateStatus(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef("config.get", habitatMethodDefs["config.get"], () =>
    Promise.resolve(getHabitatConfig()),
  ),
  defineHabitatRouteFromDef(
    "config.getSection",
    habitatMethodDefs["config.getSection"],
    asLooseRouteHandler(habitatMethodDefs["config.getSection"], (_deps, input) =>
      Promise.resolve(getHabitatConfigSection(input.section)),
    ),
  ),
  defineHabitatRouteFromDef(
    "config.patchSection",
    habitatMethodDefs["config.patchSection"],
    (_deps, input) => Promise.resolve(patchHabitatConfigSection(input.section, input.patch)),
  ),
  defineHabitatRouteFromDef(
    "config.replaceSection",
    habitatMethodDefs["config.replaceSection"],
    (_deps, input) => Promise.resolve(replaceHabitatConfigSection(input.section, input.value)),
  ),
  defineHabitatRouteFromDef(
    "config.testConnection",
    habitatMethodDefs["config.testConnection"],
    (_deps, input) => Promise.resolve(testConfigConnection(input)),
  ),
  defineHabitatRouteFromDef(
    "config.listProviderModels",
    habitatMethodDefs["config.listProviderModels"],
    (_deps, input) => Promise.resolve(listProviderModels(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "config.listProviderVoices",
    habitatMethodDefs["config.listProviderVoices"],
    // voices.models 为 readonly，与 output schema 可变数组不完全对齐
    asLooseRouteHandler(habitatMethodDefs["config.listProviderVoices"], (_deps, input) =>
      Promise.resolve(listProviderVoices(omitUndefined(input))),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.passiveRecallDebug",
    habitatMethodDefs["memory.passiveRecallDebug"],
    asLooseRouteHandler(habitatMethodDefs["memory.passiveRecallDebug"], (_deps, input) =>
      Promise.resolve(passiveRecallDebug(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalList",
    habitatMethodDefs["memory.temporalList"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalList"], (_deps, input) =>
      Promise.resolve(listTemporalSummaries(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalRegenerate",
    habitatMethodDefs["memory.temporalRegenerate"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalRegenerate"], (_deps, input) =>
      Promise.resolve(regenerateTemporalSummary(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalBackfillMissing",
    habitatMethodDefs["memory.temporalBackfillMissing"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalBackfillMissing"], (_deps, input) =>
      Promise.resolve(backfillMissingTemporalSummaries(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalRebuildRange",
    habitatMethodDefs["memory.temporalRebuildRange"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalRebuildRange"], (_deps, input) =>
      Promise.resolve(rebuildTemporalSummariesInRange(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalBatchStatus",
    habitatMethodDefs["memory.temporalBatchStatus"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalBatchStatus"], () =>
      Promise.resolve(getTemporalBatchJobStatus()),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalSystemRollList",
    habitatMethodDefs["memory.temporalSystemRollList"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalSystemRollList"], (_deps, input) =>
      Promise.resolve(listTemporalSystemRolls(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalSystemRollRegenerate",
    habitatMethodDefs["memory.temporalSystemRollRegenerate"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalSystemRollRegenerate"], (_deps, input) =>
      Promise.resolve(regenerateTemporalSystemRoll(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalSystemRollBatchStart",
    habitatMethodDefs["memory.temporalSystemRollBatchStart"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalSystemRollBatchStart"], (_deps, input) =>
      Promise.resolve(startTemporalSystemRollBatch(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.temporalSystemRollBatchStatus",
    habitatMethodDefs["memory.temporalSystemRollBatchStatus"],
    asLooseRouteHandler(habitatMethodDefs["memory.temporalSystemRollBatchStatus"], () =>
      Promise.resolve(getTemporalSystemRollBatchStatus()),
    ),
  ),
  defineHabitatRouteFromDef("memory.semanticCount", habitatMethodDefs["memory.semanticCount"], () =>
    Promise.resolve(countSemanticMemory()),
  ),
  defineHabitatRouteFromDef(
    "memory.semanticList",
    habitatMethodDefs["memory.semanticList"],
    asLooseRouteHandler(habitatMethodDefs["memory.semanticList"], (_deps, input) =>
      Promise.resolve(listSemanticMemories(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.semanticClusters",
    habitatMethodDefs["memory.semanticClusters"],
    asLooseRouteHandler(habitatMethodDefs["memory.semanticClusters"], (_deps, input) =>
      Promise.resolve(listSemanticMemoryClusters(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "memory.semanticPin",
    habitatMethodDefs["memory.semanticPin"],
    (_deps, input) => Promise.resolve(updateSemanticMemoryPinned(input)),
  ),
  defineHabitatRouteFromDef(
    "entity.searchGet",
    habitatMethodDefs["entity.searchGet"],
    (_deps, input, ctx) =>
      Promise.resolve(
        searchEntities(omitUndefined(input), requireRemoteToolsCtx(ctx).auth ?? null),
      ),
  ),
  defineHabitatRouteFromDef(
    "entity.searchPost",
    habitatMethodDefs["entity.searchPost"],
    (_deps, input, ctx) =>
      Promise.resolve(
        searchEntities(omitUndefined(input), requireRemoteToolsCtx(ctx).auth ?? null),
      ),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsList",
    habitatMethodDefs["entity.worldsList"],
    (_deps, input) => Promise.resolve(listWorldEntities(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsCreate",
    habitatMethodDefs["entity.worldsCreate"],
    (_deps, input) => Promise.resolve(createWorldEntity(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsGet",
    habitatMethodDefs["entity.worldsGet"],
    (_deps, input) => Promise.resolve(getWorldEntity(Number(input.id))),
  ),
  defineHabitatRouteFromDef(
    "entity.worldsPatch",
    habitatMethodDefs["entity.worldsPatch"],
    (_deps, input) => {
      const { id, ...body } = input;
      return Promise.resolve(updateWorldEntity(Number(id), omitUndefined(body)));
    },
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsList",
    habitatMethodDefs["entity.subjectsList"],
    (_deps, input) => Promise.resolve(listSubjectEntities(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsCreate",
    habitatMethodDefs["entity.subjectsCreate"],
    (_deps, input) => Promise.resolve(createSubjectEntity(input)),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsGet",
    habitatMethodDefs["entity.subjectsGet"],
    (_deps, input) => Promise.resolve(getSubjectEntity(Number(input.id))),
  ),
  defineHabitatRouteFromDef(
    "entity.subjectsPatch",
    habitatMethodDefs["entity.subjectsPatch"],
    (_deps, input) => {
      const { id, ...body } = input;
      return Promise.resolve(updateSubjectEntity(Number(id), body));
    },
  ),
  defineHabitatRouteFromDef(
    "self.blocks",
    habitatMethodDefs["self.blocks"],
    asLooseRouteHandler(habitatMethodDefs["self.blocks"], (_deps, input) =>
      Promise.resolve(listSelfBlocks(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "prompt.debug",
    habitatMethodDefs["prompt.debug"],
    asLooseRouteHandler(habitatMethodDefs["prompt.debug"], (_deps, input) =>
      Promise.resolve(getPromptDebug(input.conversation_id)),
    ),
  ),
  defineHabitatRouteFromDef("outposts.status", habitatMethodDefs["outposts.status"], () =>
    Promise.resolve(getOutpostsStatus()),
  ),
  defineHabitatRouteFromDef(
    "fts.status",
    habitatMethodDefs["fts.status"],
    asLooseRouteHandler(habitatMethodDefs["fts.status"], () => Promise.resolve(getFtsStatus())),
  ),
  defineHabitatRouteFromDef(
    "fts.rebuildStatus",
    habitatMethodDefs["fts.rebuildStatus"],
    asLooseRouteHandler(habitatMethodDefs["fts.rebuildStatus"], () =>
      Promise.resolve(getRebuildFtsJobStatus()),
    ),
  ),
  defineHabitatRouteFromDef(
    "fts.rebuild",
    habitatMethodDefs["fts.rebuild"],
    asLooseRouteHandler(habitatMethodDefs["fts.rebuild"], (_deps, input) =>
      Promise.resolve(startRebuildFtsIndex(omitUndefined({ onlyMissing: input.only_missing }))),
    ),
  ),
  defineHabitatRouteFromDef(
    "memoryMaintenance.summary",
    habitatMethodDefs["memoryMaintenance.summary"],
    asLooseRouteHandler(habitatMethodDefs["memoryMaintenance.summary"], () =>
      Promise.resolve(getMemoryMaintenanceSummary()),
    ),
  ),
  defineHabitatRouteFromDef(
    "memoryMaintenance.status",
    habitatMethodDefs["memoryMaintenance.status"],
    asLooseRouteHandler(habitatMethodDefs["memoryMaintenance.status"], () =>
      Promise.resolve(getMemoryMaintenanceStatus()),
    ),
  ),
  defineHabitatRouteFromDef(
    "memoryMaintenance.runStep",
    habitatMethodDefs["memoryMaintenance.runStep"],
    (_deps, input) => Promise.resolve(startMemoryMaintenanceStep(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "memoryMaintenance.startCycle",
    habitatMethodDefs["memoryMaintenance.startCycle"],
    (_deps, input) => Promise.resolve(startMemoryMaintenanceCycle(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef(
    "memoryMaintenance.startCatchUp",
    habitatMethodDefs["memoryMaintenance.startCatchUp"],
    (_deps, input) => Promise.resolve(startMemoryMaintenanceCatchUp(omitUndefined(input))),
  ),
  defineHabitatRouteFromDef("redisLocks.list", habitatMethodDefs["redisLocks.list"], () =>
    Promise.resolve(listHabitatRedisLocks()),
  ),
  defineHabitatRouteFromDef(
    "redisLocks.delete",
    habitatMethodDefs["redisLocks.delete"],
    (_deps, input) => Promise.resolve(deleteHabitatRedisLock(input)),
  ),
  defineHabitatRouteFromDef("dataIntegrity.run", habitatMethodDefs["dataIntegrity.run"], () =>
    Promise.resolve(runDataIntegrityCheck()),
  ),
  defineHabitatRouteFromDef(
    "cronLogs.list",
    habitatMethodDefs["cronLogs.list"],
    asLooseRouteHandler(habitatMethodDefs["cronLogs.list"], (_deps, input) =>
      Promise.resolve(listCronLogs(omitUndefined(input))),
    ),
  ),
  defineHabitatRouteFromDef(
    "autoLlmRuns.list",
    habitatMethodDefs["autoLlmRuns.list"],
    asLooseRouteHandler(habitatMethodDefs["autoLlmRuns.list"], (_deps, input) =>
      Promise.resolve(listAutoLlmRuns(omitUndefined(input))),
    ),
  ),
  defineHabitatRouteFromDef(
    "autoLlmRuns.get",
    habitatMethodDefs["autoLlmRuns.get"],
    asLooseRouteHandler(habitatMethodDefs["autoLlmRuns.get"], (_deps, input) =>
      Promise.resolve(getAutoLlmRun(input)),
    ),
  ),
  defineHabitatRouteFromDef(
    "usage.today",
    habitatMethodDefs["usage.today"],
    asLooseRouteHandler(habitatMethodDefs["usage.today"], () => Promise.resolve(getUsageToday())),
  ),
  defineHabitatRouteFromDef("worlds.context", habitatMethodDefs["worlds.context"], () =>
    Promise.resolve(getResolvedWorldContext()),
  ),
  defineHabitatRouteFromDef(
    "conversation.adminGet",
    habitatMethodDefs["conversation.adminGet"],
    asLooseRouteHandler(habitatMethodDefs["conversation.adminGet"], (_deps, input) =>
      Promise.resolve(getConversationInfo(input.conversationId)),
    ),
  ),
  defineHabitatRouteFromDef(
    "conversation.adminListAll",
    habitatMethodDefs["conversation.adminListAll"],
    (_deps, input) =>
      Promise.resolve(
        listConversations(
          input.platform?.trim() || undefined,
          omitUndefined({
            offset: input.offset ?? 0,
            limit: input.limit ?? 10_000,
            scenario: input.scenario,
          }),
        ),
      ),
  ),
  defineHabitatRouteFromDef(
    "conversation.adminCreate",
    habitatMethodDefs["conversation.adminCreate"],
    (_deps, input) => Promise.resolve(createConversation(input)),
  ),
  defineHabitatRouteFromDef(
    "tokens.listForSubject",
    habitatMethodDefs["tokens.listForSubject"],
    async (_deps, input, ctx) => {
      requireFullAuth(ctx);
      await getSubjectEntity(input.id);
      const items = await listServiceApiTokensBySubject(input.id);
      return { items };
    },
  ),
  defineHabitatRouteFromDef(
    "tokens.createForSubject",
    habitatMethodDefs["tokens.createForSubject"],
    async (_deps, input, ctx) => {
      requireFullAuth(ctx);
      await getSubjectEntity(input.id);
      const trimmed = input.name.trim();
      const preset = input.preset;
      const world_ids = input.world_ids;
      const authzInput = input.authorization;
      if (!trimmed) {
        throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
      }
      const authorization = authzInput
        ? parseServiceApiTokenAuthorization(authzInput)
        : !preset || preset === "full"
          ? FULL_TOKEN_AUTHORIZATION
          : expandTokenPreset(
              preset,
              world_ids && world_ids.length > 0 ? { worldIds: world_ids } : undefined,
            );
      const result = await createServiceApiTokenWithSecret({
        subject_id: input.id,
        name: trimmed,
        authorization,
      });
      return { token: result.token, plaintext: result.plaintext };
    },
  ),
  defineHabitatRouteFromDef(
    "tokens.revoke",
    habitatMethodDefs["tokens.revoke"],
    async (_deps, input, ctx) => {
      requireFullAuth(ctx);
      const row = await getServiceApiTokenById(input.id);
      if (!row) {
        throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
      }
      const ok = await revokeServiceApiToken(input.id);
      if (!ok) {
        throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
      }
      return { ok: true as const };
    },
  ),
  defineHabitatRouteFromDef(
    "tokens.reveal",
    habitatMethodDefs["tokens.reveal"],
    async (_deps, input, ctx) => {
      requireFullAuth(ctx);
      const row = await getServiceApiTokenById(input.id);
      if (!row) {
        throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
      }
      try {
        const plaintext = await revealServiceApiTokenPlaintext(input.id);
        return { plaintext };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("not revealable")) {
          throw new ApiHandlerError(400, message, { code: "token_not_revealable" });
        }
        if (message.includes("revoked or expired")) {
          throw new ApiHandlerError(400, message, { code: "token_inactive" });
        }
        throw new ApiHandlerError(404, message, { code: "token_not_found" });
      }
    },
  ),
  defineHabitatRouteFromDef(
    "tokens.updateName",
    habitatMethodDefs["tokens.updateName"],
    async (_deps, input, ctx) => {
      requireFullAuth(ctx);
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
      }
      try {
        const token = await updateServiceApiTokenName(input.id, trimmed);
        return { token };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("name is required")) {
          throw new ApiHandlerError(400, message, { code: "token_name_required" });
        }
        throw new ApiHandlerError(404, message, { code: "token_not_found" });
      }
    },
  ),
  defineHabitatRouteFromDef("skill.list", habitatMethodDefs["skill.list"], () =>
    Promise.resolve(listHabitatSkills()),
  ),
  defineHabitatRouteFromDef("skill.get", habitatMethodDefs["skill.get"], async (_deps, input) => {
    const skill = await getHabitatSkill(input.name);
    if (!skill) throw new ApiHandlerError(404, `Skill '${input.name}' not found`);
    return skill;
  }),
  defineHabitatRouteFromDef(
    "tts.synthesize",
    habitatMethodDefs["tts.synthesize"],
    asLooseRouteHandler(habitatMethodDefs["tts.synthesize"], (deps, input, ctx) =>
      handleTtsSynthesize(
        asRouteDeps<RemoteToolsServerDeps>(deps),
        input,
        asRouteCtx<RemoteToolsRequestContext>(ctx),
      ),
    ),
  ),
  defineHabitatRouteFromDef(
    "asr.transcribe",
    habitatMethodDefs["asr.transcribe"],
    asLooseRouteHandler(habitatMethodDefs["asr.transcribe"], (deps, input, ctx) =>
      handleAsrTranscribe(
        asRouteDeps<RemoteToolsServerDeps>(deps),
        input,
        asRouteCtx<RemoteToolsRequestContext>(ctx),
      ),
    ),
  ),
]);
