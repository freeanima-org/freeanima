import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import { omitUndefined } from "@freeanima/core/util";
import {
  getAcpStatus,
  acpStartAgent,
  acpStartAll,
  acpStopAgent,
  acpStopAll,
} from "./handlers/acp.ts";
import { listAutoLlmRuns } from "./handlers/auto-llm-runs.ts";
import { fetchConversationAcpDock } from "./handlers/conversation-events.ts";
import {
  createConversation,
  getConversationInfo,
  getPlatforms,
  getStoredMessages,
  listCommands,
  listConversations,
  setConversationTitle,
} from "./handlers/conversations.ts";
import {
  searchEntities,
  createSubjectEntity,
  createWorldEntity,
  getSubjectEntity,
  getWorldEntity,
  listSubjectEntities,
  listWorldEntities,
  updateSubjectEntity,
  updateWorldEntity,
} from "./handlers/entities.ts";
import { getFtsStatus, getRebuildFtsJobStatus, startRebuildFtsIndex } from "./handlers/fts.ts";
import {
  countSemanticMemory,
  listAutobiographicalMemories,
  listLimbicMemories,
  listMemoryFiles,
  listSemanticMemories,
  memorySearch,
  updateSemanticMemoryPinned,
} from "./handlers/memory.ts";
import {
  getMcpStatus,
  mcpStartAll,
  mcpStartServer,
  mcpStopAll,
  mcpStopServer,
} from "./handlers/mcp.ts";
import { getPromptDebug } from "./handlers/prompt.ts";
import { getSatellitesStatus } from "./handlers/satellites.ts";
import { listSelfBlocks } from "./handlers/self.ts";
import {
  getDeepSleepRounds,
  getSleepPipelineStatus,
  getSleepSummary,
  listCronLogs,
  listPipelineStepRuns,
  startSleepCycle,
  startSleepPipelineStep,
} from "./handlers/sleep.ts";
import {
  getStatus,
  listCronJobs,
  listTools,
  pauseCronJob,
  restartService,
  resumeCronJob,
  runCronJobNow,
} from "./handlers/status.ts";
import {
  getHubConfig,
  getHubConfigSection,
  importHubConfigFromFile,
  patchHubConfigSection,
} from "./handlers/config.ts";

/** Console Hub RPC method handlers */
export const consoleHubHandlers = {
  "status.get": () => getStatus(),
  "config.get": () => getHubConfig(),
  "config.getSection": (payload: { section: string }) => getHubConfigSection(payload.section),
  "config.patchSection": (payload: { section: string; patch: Record<string, unknown> }) =>
    patchHubConfigSection(payload.section, payload.patch),
  "config.importFromFile": () => importHubConfigFromFile(),
  "status.tools": (payload: { scope?: "default" }) =>
    listTools(payload.scope === "default" ? "default" : undefined),
  "status.platforms": () => getPlatforms(),
  "status.cronJobs": () => listCronJobs(),
  "status.cronJobPause": (payload: { id: string }) => pauseCronJob(payload.id),
  "status.cronJobResume": (payload: { id: string }) => resumeCronJob(payload.id),
  "status.cronJobRun": (payload: { id: string }) => runCronJobNow(payload.id),
  "status.restart": () => restartService(),
  "memory.files": () => listMemoryFiles(),
  "memory.search": (payload: { query: string; limit?: number }) => memorySearch(payload),
  "memory.semanticCount": () => countSemanticMemory(),
  "memory.semanticList": (payload: Record<string, unknown>) => listSemanticMemories(payload),
  "memory.semanticPin": (payload: { id: string; pinned: boolean }) =>
    updateSemanticMemoryPinned(payload),
  "memory.limbicList": (payload: Record<string, unknown>) => listLimbicMemories(payload),
  "memory.autobiographicalList": (payload: Record<string, unknown>) =>
    listAutobiographicalMemories(payload),
  "entity.searchGet": (payload: Record<string, unknown>) => searchEntities(payload),
  "entity.searchPost": (payload: Record<string, unknown>) => searchEntities(payload),
  "entity.worldsList": (payload: Record<string, unknown>) => listWorldEntities(payload),
  "entity.worldsCreate": (payload: Record<string, unknown>) =>
    createWorldEntity(payload as Parameters<typeof createWorldEntity>[0]),
  "entity.worldsGet": (payload: { id: string }) => getWorldEntity(Number(payload.id)),
  "entity.worldsPatch": (payload: Record<string, unknown>) => {
    const { id, ...body } = payload;
    return updateWorldEntity(Number(id), body);
  },
  "entity.subjectsList": (payload: Record<string, unknown>) => listSubjectEntities(payload),
  "entity.subjectsCreate": (payload: Record<string, unknown>) =>
    createSubjectEntity(payload as Parameters<typeof createSubjectEntity>[0]),
  "entity.subjectsGet": (payload: { id: string }) => getSubjectEntity(Number(payload.id)),
  "entity.subjectsPatch": (payload: Record<string, unknown>) => {
    const { id, ...body } = payload;
    return updateSubjectEntity(Number(id), body);
  },
  "self.blocks": () => listSelfBlocks(),
  "prompt.debug": (payload: { conversation_id?: string }) =>
    getPromptDebug(payload.conversation_id),
  "src/satellites.status": () => getSatellitesStatus(),
  "acp.status": () => getAcpStatus(),
  "acp.startAll": () => acpStartAll(),
  "acp.stopAll": () => acpStopAll(),
  "acp.startAgent": (payload: { name: string }) => acpStartAgent(payload.name),
  "acp.stopAgent": (payload: { name: string }) => acpStopAgent(payload.name),
  "fts.status": () => getFtsStatus(),
  "fts.rebuildStatus": () => getRebuildFtsJobStatus(),
  "fts.rebuild": (payload: { only_missing?: boolean }) =>
    startRebuildFtsIndex(omitUndefined({ onlyMissing: payload.only_missing })),
  "sleep.summary": () => getSleepSummary(),
  "sleep.pipelineRuns": (payload: {
    step_id?: string;
    run_id?: string;
    limit?: number;
    offset?: number;
  }) => listPipelineStepRuns(omitUndefined(payload)),
  "sleep.deepSleepRounds": (payload: { day: string }) => getDeepSleepRounds(payload.day),
  "sleep.pipelineStatus": () => getSleepPipelineStatus(),
  "sleep.startCycle": (payload: { day?: string; deep_sleep_mode?: "full" | "incremental" }) =>
    startSleepCycle(omitUndefined(payload)),
  "sleep.runPipelineStep": (payload: {
    step_id: string;
    day?: string;
    force?: boolean;
    deep_sleep_mode?: "full" | "incremental";
  }) => startSleepPipelineStep(omitUndefined(payload)),
  "cronLogs.list": (payload: { job_id?: string; limit?: number; offset?: number; ok?: boolean }) =>
    listCronLogs(omitUndefined(payload)),
  "autoLlmRuns.list": (payload: {
    run_kind?: string;
    status?: "ok" | "error";
    limit?: number;
    offset?: number;
  }) => listAutoLlmRuns(omitUndefined(payload)),
  "worlds.context": () => getResolvedWorldContext(),
  "conversation.adminGet": (payload: { conversationId: string }) =>
    getConversationInfo(payload.conversationId),
  "conversation.adminListAll": () => listConversations(undefined, { offset: 0, limit: 10_000 }),
  "conversation.adminCreate": (payload: { platform: string }) => createConversation(payload),
  "conversation.list": (payload: { platform?: string; offset?: number; limit?: number }) =>
    listConversations(
      payload.platform,
      omitUndefined({ offset: payload.offset, limit: payload.limit }),
    ),
  "conversation.create": (payload: { platform: string }) => createConversation(payload),
  "conversation.messages": (payload: {
    conversation_id: string;
    offset?: number;
    limit?: number;
  }) =>
    getStoredMessages(
      payload.conversation_id,
      omitUndefined({ offset: payload.offset, limit: payload.limit }),
    ),
  "conversation.patchTitle": (payload: { conversation_id: string; title: string }) =>
    setConversationTitle(payload.conversation_id, { title: payload.title }),
  "conversation.commands": (payload: { all?: boolean; platform?: string }) => listCommands(payload),
  "conversation.acpDock": (payload: { conversation_id: string }) =>
    fetchConversationAcpDock(payload.conversation_id),
  "mcp.status": () => getMcpStatus(),
  "mcp.startAll": () => mcpStartAll(),
  "mcp.stopAll": () => mcpStopAll(),
  "mcp.startServer": (payload: { name: string }) => mcpStartServer(payload.name),
  "mcp.stopServer": (payload: { name: string }) => mcpStopServer(payload.name),
} as const;

export type ConsoleHubMethod = keyof typeof consoleHubHandlers;

export async function invokeConsoleHubHandler(method: string, payload: unknown): Promise<unknown> {
  const handler = consoleHubHandlers[method as ConsoleHubMethod];
  if (!handler) {
    throw new Error(`unknown console hub method: ${method}`);
  }
  return handler(payload as never);
}
