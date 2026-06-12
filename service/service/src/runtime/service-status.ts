import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getTokenizerBindingSnapshot } from "@freeanima/orchestration-runtime";
import {
  getDefaultProviderBaseUrl,
  getProfileHopModel,
  isEmbeddingEnabled,
  sanitizeConfigForApi,
  PATHS,
} from "@freeanima/service-config";
import { formatCstIsoFromEpoch } from "@freeanima/storage-util";
import type { FullRuntimeDeps, RuntimeDeps } from "./runtime-deps.ts";
import { PROFILE_CHAT } from "@freeanima/storage-provider-llm";
import {
  ensureBuiltinCronJobs,
  getJob,
  listJobs,
  pauseJob,
  resumeJob,
  enqueueRunJob,
} from "@freeanima/connectors-cron";
import type { CronJobData } from "@freeanima/connectors-cron";
import { buildToolsStatus } from "@freeanima/mechanism-tool";
import { listCommandDefs, listCommandDefsForPlatform } from "@freeanima/service-commands";
import { pingDatabase, isJiebaLoaded } from "@freeanima/connectors-db-pg";
import { pingRedis } from "@freeanima/connectors-redis";
import { listLoadedTokenizerRepos, listTokenizerBindings } from "@freeanima/storage-tokenizer";
import type {
  DependencyStatus,
  HealthSnapshot,
  PlatformStatusSnapshot,
  ProcessMemoryDetail,
  SafeConfigSnapshot,
  ServiceSnapshot,
} from "@freeanima/service/schemas/snapshot";
import { PARLOR_PLATFORM } from "./platforms.ts";
import { ANIMA_VERSION } from "./version.ts";

export function startTimeIso(epochSec: number): string {
  return formatCstIsoFromEpoch(epochSec);
}

export function buildMemoryFileStats(): { files_count: number; files_bytes: number } {
  let files_count = 0;
  let files_bytes = 0;
  const add = (path: string) => {
    if (!existsSync(path)) return;
    try {
      files_count++;
      files_bytes += statSync(path).size;
    } catch {
      /* ignore */
    }
  };

  add(join(PATHS.home, "MEMORY.md"));
  add(join(PATHS.home, "USER.md"));

  return { files_count, files_bytes };
}

function readProcessRssKb(): number {
  try {
    const statusText = readFileSync(`/proc/${process.pid}/status`, "utf-8");
    for (const line of statusText.split("\n")) {
      if (line.startsWith("VmRSS:")) {
        return parseInt(line.split(/\s+/)[1] ?? "0", 10);
      }
    }
  } catch {
    /* non-Linux */
  }
  return 0;
}

function buildProcessMemoryDetail(deps: FullRuntimeDeps): ProcessMemoryDetail {
  const mu = process.memoryUsage();
  let mcp = { server_count: 0, connected_count: 0, connecting_count: 0 };
  let acp = { agent_count: 0, connected_count: 0 };
  if (deps.mcp) {
    mcp = deps.mcp.getConnectionSummary();
  }
  if (deps.acp) {
    const acpStatus = deps.acp.getStatus();
    acp = {
      agent_count: acpStatus.agent_count,
      connected_count: acpStatus.connected_count,
    };
  }

  return {
    rss_kb: readProcessRssKb(),
    heap_used_kb: Math.round(mu.heapUsed / 1024),
    heap_total_kb: Math.round(mu.heapTotal / 1024),
    external_kb: Math.round(mu.external / 1024),
    array_buffers_kb: Math.round(mu.arrayBuffers / 1024),
    tokenizer_repos: listLoadedTokenizerRepos(),
    tokenizer_bindings: listTokenizerBindings(),
    jieba_loaded: isJiebaLoaded(),
    mcp,
    acp,
  };
}

export async function buildSessionsByPlatform(deps: RuntimeDeps): Promise<Record<string, number>> {
  try {
    return await deps.conversation.countSessionsByPlatform();
  } catch {
    return {};
  }
}

export function health(): HealthSnapshot {
  return { status: "ok", version: ANIMA_VERSION };
}

export async function buildDependenciesStatus(): Promise<{
  postgres: DependencyStatus;
  redis: DependencyStatus;
}> {
  const [postgres, redis] = await Promise.all([pingDatabase(), pingRedis()]);
  return { postgres, redis };
}

export async function buildStatus(
  deps: FullRuntimeDeps,
  startTime: number,
  platformStatus: Record<string, PlatformStatusSnapshot>,
  cronJobCount: number,
  host: string,
  port: number,
): Promise<ServiceSnapshot> {
  const cfg = deps.engine.config.data;
  const uptime = startTime > 0 ? Math.round(Date.now() / 1000 - startTime) : null;

  const byPlatform = await buildSessionsByPlatform(deps);
  const sessionCount = Object.values(byPlatform).reduce((a, b) => a + b, 0);

  let toolCount = 0;
  try {
    toolCount = deps.engine.catalog.toolSets.listTools().length;
  } catch {
    toolCount = 0;
  }

  const memoryDetail = buildProcessMemoryDetail(deps);

  const fileStats = buildMemoryFileStats();
  const dependencies = await buildDependenciesStatus();
  let factsCount = 0;
  let l2IndexRows = 0;
  try {
    factsCount = await deps.engine.repos.semanticMemory.count();
  } catch {
    factsCount = 0;
  }
  try {
    l2IndexRows = await deps.conversation.repos.session.countSearchableMessages();
  } catch {
    l2IndexRows = 0;
  }

  const chatModel = getProfileHopModel(cfg, PROFILE_CHAT);
  const tokenizerStatus: ServiceSnapshot["tokenizer"] = {};
  const chatBinding = getTokenizerBindingSnapshot(chatModel);
  if (chatBinding) tokenizerStatus.chat = chatBinding;

  if (isEmbeddingEnabled(cfg)) {
    const embeddingModel = cfg.embedding?.model?.trim();
    if (embeddingModel) {
      const embeddingBinding = getTokenizerBindingSnapshot(embeddingModel);
      if (embeddingBinding) tokenizerStatus.embedding = embeddingBinding;
    }
  }

  const status: ServiceSnapshot = {
    status: "running",
    pid: process.pid,
    version: ANIMA_VERSION,
    uptime_seconds: uptime,
    start_time_iso: startTimeIso(startTime),
    config: {
      model: chatModel,
      api_base: getDefaultProviderBaseUrl(cfg),
    },
    tokenizer: tokenizerStatus.chat || tokenizerStatus.embedding ? tokenizerStatus : undefined,
    sessions: { total: sessionCount, by_platform: byPlatform },
    tools: toolCount,
    cron_jobs: cronJobCount,
    platforms: { ...platformStatus },
    memory_kb: memoryDetail.rss_kb,
    memory_detail: memoryDetail,
    memory: {
      files_count: fileStats.files_count,
      files_bytes: fileStats.files_bytes,
      semantic_memory_count: factsCount,
      dialogue_message_count: l2IndexRows,
    },
    dependencies,
  };
  if (host) status.host = host;
  if (port) status.port = port;
  return status;
}

export function getConfig(deps: RuntimeDeps): SafeConfigSnapshot {
  const cfg = deps.engine.config.data;
  return { config: sanitizeConfigForApi(cfg) as SafeConfigSnapshot["config"] };
}

export function listToolsApi(deps: RuntimeDeps) {
  return buildToolsStatus(deps.engine.catalog.toolSets);
}

export async function listCronJobs(): Promise<{ jobs: CronJobData[] }> {
  const jobs = await listJobs();
  return { jobs: jobs.map((j) => j.toJSON()) };
}

export async function pauseCronJob(jobId: string): Promise<CronJobData | null> {
  if (!(await pauseJob(jobId))) return null;
  const job = await getJob(jobId);
  return job?.toJSON() ?? null;
}

export async function resumeCronJob(jobId: string): Promise<CronJobData | null> {
  if (!(await resumeJob(jobId))) return null;
  const job = await getJob(jobId);
  return job?.toJSON() ?? null;
}

export async function runCronJobNow(
  jobId: string,
): Promise<{ job: CronJobData; message: string } | null> {
  const job = await getJob(jobId);
  if (!job) return null;
  void enqueueRunJob(job);
  return {
    job: job.toJSON(),
    message: `Triggered immediate run: ${job.name}`,
  };
}

export async function ensureBuiltinCronJobsRegistered(): Promise<void> {
  await ensureBuiltinCronJobs();
}

export function listCommands(opts?: { platform?: string; all?: boolean }): {
  commands: {
    name: string;
    description: string;
    scope: string;
    platforms: string[] | null;
  }[];
  platform?: string;
} {
  const platform = opts?.platform ?? PARLOR_PLATFORM;
  const defs = opts?.all ? listCommandDefs() : listCommandDefsForPlatform(platform);
  return {
    commands: defs.map((c) => ({
      name: c.name,
      description: c.description,
      scope: c.scope ?? "session",
      platforms: c.platforms?.length ? [...c.platforms] : null,
    })),
    ...(opts?.all ? {} : { platform }),
  };
}
