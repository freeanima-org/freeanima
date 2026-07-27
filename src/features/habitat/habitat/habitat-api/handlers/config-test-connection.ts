import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  getResolvedEmbeddingConfig,
  type RuntimeConfig,
} from "@freeanima/host/core/config";
import { createOpenAiEmbeddingClient } from "@freeanima/host/capabilities/llm-openai";
import { createOpenAiClientFromParsed } from "@freeanima/host/capabilities/llm-openai/client.ts";
import { fetchModelCatalog } from "@freeanima/host/capabilities/llm-openai/catalog.ts";
import { parseOpenAiCompatibleContext } from "@freeanima/host/capabilities/llm-openai/context.ts";
import { OPENAI_COMPATIBLE_BACKEND_ID } from "@freeanima/host/core/config/schemas/llm-config.ts";
import { resolveValue } from "@freeanima/host/platform/config/resolve.ts";
import { CONFIG_MASKED_SECRET } from "@freeanima/host/platform/config";
import { createBunS3Client } from "@freeanima/features/object-storage/domain/bun-s3.ts";
import { z } from "zod";

import { ApiHandlerError } from "./errors.ts";
import { habitatCtx } from "./runtime.ts";
import { probeDiscordBotToken, probeWeixinIlinkToken } from "./config-test-gateway-probes.ts";

const TEST_TIMEOUT_MS = 15_000;

export const configTestConnectionInputSchema = z.object({
  service: z.enum([
    "firecrawl",
    "camofox",
    "embedding",
    "llm_provider",
    "discord",
    "weixin",
    "object_storage",
  ]),
  config: z.record(z.string(), z.unknown()).optional(),
  provider_id: z.string().min(1).optional(),
});

export const configTestConnectionOutputSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  latency_ms: z.number().int().nonnegative().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ConfigTestConnectionInput = z.infer<typeof configTestConnectionInputSchema>;
export type ConfigTestConnectionResult = z.infer<typeof configTestConnectionOutputSchema>;

function runtimeConfig(): RuntimeConfig {
  return habitatCtx().engine.config.data as RuntimeConfig;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** 表单草稿优先；仅 *** 或未提供时回退到已保存配置（未脱敏） */
export function pickConfigString(draft: unknown, saved: unknown): string {
  if (typeof draft === "string") {
    const trimmed = draft.trim();
    if (trimmed === CONFIG_MASKED_SECRET) {
      return typeof saved === "string" ? saved.trim() : "";
    }
    return trimmed;
  }
  return typeof saved === "string" ? saved.trim() : "";
}

export async function resolveConfigString(draft: unknown, saved: unknown): Promise<string> {
  const raw = pickConfigString(draft, saved);
  if (!raw) return "";
  try {
    return await resolveValue(raw);
  } catch (err) {
    throw new ApiHandlerError(400, err instanceof Error ? err.message : String(err), {
      code: "config_secret_resolve_failed",
    });
  }
}

function failure(message: string): ConfigTestConnectionResult {
  return { ok: false, message };
}

function success(
  message: string,
  latencyMs: number,
  details?: Record<string, unknown>,
): ConfigTestConnectionResult {
  return {
    ok: true,
    message,
    latency_ms: latencyMs,
    ...(details ? { details } : {}),
  };
}

async function testFirecrawl(draft: Record<string, unknown>): Promise<ConfigTestConnectionResult> {
  const saved = asRecord(runtimeConfig().firecrawl);
  const apiUrl = (
    pickConfigString(draft.api_url, saved.api_url) || "https://api.firecrawl.dev"
  ).replace(/\/$/, "");
  let apiKey = "";
  try {
    apiKey = await resolveConfigString(draft.api_key, saved.api_key);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }

  const started = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const resp = await fetch(`${apiUrl}/v1/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "ping", limit: 1 }),
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return failure(`Firecrawl 返回 HTTP ${resp.status}${text ? `：${text.slice(0, 160)}` : ""}`);
    }
    return success("Firecrawl 连接成功", Date.now() - started, { api_url: apiUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("timeout")) {
      return failure("Firecrawl 请求超时");
    }
    return failure(`Firecrawl 连接失败：${msg}`);
  }
}

async function testCamofox(draft: Record<string, unknown>): Promise<ConfigTestConnectionResult> {
  const savedBrowser = asRecord(runtimeConfig().browser);
  const saved = asRecord(savedBrowser.camofox);
  const baseUrl = pickConfigString(draft.base_url, saved.base_url).replace(/\/$/, "");
  if (!baseUrl) return failure("请填写 camofox base_url");

  const timeoutRaw = draft.timeout_ms ?? saved.timeout_ms;
  const timeoutMs = typeof timeoutRaw === "number" && timeoutRaw > 0 ? timeoutRaw : TEST_TIMEOUT_MS;

  const started = Date.now();
  try {
    const resp = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(Math.min(timeoutMs, TEST_TIMEOUT_MS)),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return failure(`Camofox 返回 HTTP ${resp.status}${text ? `：${text.slice(0, 160)}` : ""}`);
    }
    let vncPort: number | undefined;
    try {
      const data = (await resp.json()) as Record<string, unknown>;
      if (typeof data.vncPort === "number") vncPort = data.vncPort;
    } catch {
      /* 非 JSON 也视为连通 */
    }
    return success("Camofox 连接成功", Date.now() - started, {
      base_url: baseUrl,
      ...(vncPort != null ? { vnc_port: vncPort } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("timeout")) {
      return failure("Camofox 请求超时");
    }
    return failure(`Camofox 连接失败：${msg}`);
  }
}

async function testEmbedding(draft: Record<string, unknown>): Promise<ConfigTestConnectionResult> {
  const saved = asRecord(runtimeConfig().embedding);
  const enabled = draft.enabled !== undefined ? draft.enabled !== false : saved.enabled !== false;
  if (!enabled) return failure("embedding 已禁用");

  const merged = {
    enabled: true as const,
    base_url: pickConfigString(draft.base_url, saved.base_url) || undefined,
    api_key: pickConfigString(draft.api_key, saved.api_key) || undefined,
    model: pickConfigString(draft.model, saved.model) || undefined,
    dimensions:
      typeof draft.dimensions === "number" && draft.dimensions > 0
        ? draft.dimensions
        : typeof saved.dimensions === "number" && saved.dimensions > 0
          ? saved.dimensions
          : DEFAULT_EMBEDDING_DIMENSIONS,
    timeout_ms:
      typeof draft.timeout_ms === "number" && draft.timeout_ms > 0
        ? draft.timeout_ms
        : typeof saved.timeout_ms === "number" && saved.timeout_ms > 0
          ? saved.timeout_ms
          : undefined,
  };

  let apiKey = merged.api_key ?? "";
  try {
    apiKey = await resolveConfigString(draft.api_key, saved.api_key);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }

  const cfg = getResolvedEmbeddingConfig({
    ...runtimeConfig(),
    embedding: { ...merged, api_key: apiKey || undefined },
  });
  if (!cfg) return failure("请填写 embedding model");

  const started = Date.now();
  try {
    const embed = createOpenAiEmbeddingClient(cfg);
    const vector = await embed("ping");
    if (!vector?.length) return failure("Embedding 返回空向量");
    if (vector.length !== cfg.dimensions) {
      return failure(`向量维度 ${vector.length} 与配置 ${cfg.dimensions} 不一致`);
    }
    return success("Embedding 连接成功", Date.now() - started, {
      model: cfg.model,
      base_url: cfg.baseUrl,
      dimensions: vector.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      return failure(
        `Embedding 连接失败：${msg}（请确认 base_url 含 /v1，例如 http://host:11434/v1）`,
      );
    }
    return failure(`Embedding 连接失败：${msg}`);
  }
}

async function testLlmProvider(
  providerId: string,
  draft: Record<string, unknown>,
): Promise<ConfigTestConnectionResult> {
  const savedLlm = asRecord(runtimeConfig().llm);
  const savedProviders = asRecord(savedLlm.providers);
  const saved = asRecord(savedProviders[providerId]);

  const baseUrl = pickConfigString(draft.base_url, saved.base_url);
  if (!baseUrl) return failure("请填写 base_url");

  const backend = pickConfigString(draft.backend, saved.backend) || OPENAI_COMPATIBLE_BACKEND_ID;
  if (backend !== OPENAI_COMPATIBLE_BACKEND_ID) {
    return failure(`暂不支持测试 backend：${backend}`);
  }

  let apiKey = "";
  try {
    apiKey = await resolveConfigString(draft.api_key, saved.api_key);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
  if (!apiKey) return failure("请填写 api_key 或配置 env/vault 引用");

  const timeoutRaw = draft.timeout_ms ?? saved.timeout_ms;
  const timeoutMs = typeof timeoutRaw === "number" && timeoutRaw > 0 ? timeoutRaw : TEST_TIMEOUT_MS;

  const started = Date.now();
  try {
    const client = createOpenAiClientFromParsed(
      parseOpenAiCompatibleContext({
        baseUrl,
        apiKey,
        timeoutMs,
      }),
    );
    const models = await fetchModelCatalog(client);
    if (models.length === 0) return failure("已连接但未返回可用模型");
    return success(`LLM 连接成功（${models.length} 个模型）`, Date.now() - started, {
      provider_id: providerId,
      base_url: baseUrl.replace(/\/$/, ""),
      model_count: models.length,
      sample_models: models.slice(0, 5).map((m) => m.model),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure(`LLM 连接失败：${msg}`);
  }
}

async function testDiscord(draft: Record<string, unknown>): Promise<ConfigTestConnectionResult> {
  const saved = asRecord(runtimeConfig().discord);
  if (draft.enabled === false || (draft.enabled === undefined && saved.enabled === false)) {
    return failure("Discord 已禁用");
  }
  let token = "";
  try {
    token = await resolveConfigString(draft.token, saved.token);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
  if (!token) return failure("请填写 discord.token 或配置 env/vault 引用");

  const started = Date.now();
  try {
    const { tag } = await probeDiscordBotToken(token);
    return success(`Discord 连接成功（${tag}）`, Date.now() - started, { bot: tag });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure(`Discord 连接失败：${msg}`);
  }
}

/** S3 客户端错误常缺结构化 Code；尽量带上 HTTP 状态与提示 */
function formatS3ClientError(err: unknown, hints: string[] = []): string {
  if (!(err instanceof Error) && (err === null || typeof err !== "object")) {
    return String(err);
  }
  const e = err as Error & {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number; requestId?: string };
  };
  const code =
    (typeof e.Code === "string" && e.Code) ||
    (typeof e.code === "string" && e.code) ||
    (e.name && e.name !== "Error" ? e.name : "");
  const msg = (e.message ?? "").trim();
  const status = e.$metadata?.httpStatusCode;
  const requestId = e.$metadata?.requestId;
  const parts: string[] = [];
  if (code && code !== "UnknownError") parts.push(code);
  if (msg && msg !== "UnknownError" && msg !== code) parts.push(msg);
  if (status != null) parts.push(`HTTP ${status}`);
  if (requestId) parts.push(`requestId=${requestId}`);
  if (parts.length === 0 && (code === "UnknownError" || msg === "UnknownError")) {
    parts.push("UnknownError（响应体无法解析，多为网络不可达或非 S3 错误页）");
  } else if (parts.length === 0) {
    parts.push(String(err));
  }
  for (const hint of hints) parts.push(hint);
  return parts.join(" · ");
}

function objectStorageReachabilityHints(endpointHost: string): string[] {
  const hints: string[] = [];
  if (/-internal(\.|$)/i.test(endpointHost)) {
    hints.push(
      "当前是内网 endpoint，Habitat 若不在同 VPC 会连不上；请改公网 endpoint 或把 Habitat 放到同网",
    );
  } else {
    hints.push(
      "请确认 bucket/账号已开公网访问，且本机/Habitat 能到达该 endpoint（防火墙、白名单、未绑公网）",
    );
  }
  return hints;
}

async function testObjectStorage(
  draft: Record<string, unknown>,
): Promise<ConfigTestConnectionResult> {
  const saved = asRecord(runtimeConfig().object_storage);
  const endpoint = pickConfigString(draft.endpoint, saved.endpoint).replace(/\/$/, "");
  const bucket = pickConfigString(draft.bucket, saved.bucket);
  const region = pickConfigString(draft.region, saved.region) || "us-east-1";
  if (!endpoint) return failure("请填写 endpoint");
  if (!bucket) return failure("请填写 bucket");

  let accessKeyId = "";
  let secretAccessKey = "";
  try {
    accessKeyId = await resolveConfigString(draft.access_key_id, saved.access_key_id);
    secretAccessKey = await resolveConfigString(draft.secret_access_key, saved.secret_access_key);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
  if (!accessKeyId) return failure("请填写 access_key_id 或配置 env/vault 引用");
  if (!secretAccessKey) return failure("请填写 secret_access_key 或配置 env/vault 引用");

  const forcePathStyle =
    typeof draft.force_path_style === "boolean"
      ? draft.force_path_style
      : saved.force_path_style === true;

  let endpointHost = "";
  try {
    endpointHost = new URL(endpoint).hostname;
  } catch {
    return failure(`endpoint 不是合法 URL：${endpoint}`);
  }

  const client = createBunS3Client({
    endpoint,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
  });

  // 勿用 list()：Bun 对自定义 endpoint 常走 ListBuckets；阿里云桶内 RW 子账号无此权限会误报失败。
  // 用写读删探测真实 Put/Get（与业务路径一致）。
  const probeKey = `_freeanima/connection-probe/${Date.now()}.txt`;
  const probeBody = new TextEncoder().encode("freeanima-object-storage-probe");

  const started = Date.now();
  try {
    await Promise.race([
      (async () => {
        await client.write(probeKey, probeBody);
        const got = new Uint8Array(await client.file(probeKey).bytes());
        if (got.byteLength !== probeBody.byteLength) {
          throw new Error("probe read size mismatch");
        }
        try {
          await client.delete(probeKey);
        } catch {
          /* 删失败不阻断连通性判定 */
        }
      })(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), TEST_TIMEOUT_MS);
      }),
    ]);
    return success("对象存储连接成功", Date.now() - started, {
      endpoint,
      bucket,
      region,
      force_path_style: forcePathStyle,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const reachHints = objectStorageReachabilityHints(endpointHost);
    if (raw.includes("abort") || raw.toLowerCase().includes("timeout")) {
      return failure(`对象存储请求超时 · ${reachHints.join(" · ")}`);
    }
    // ECONNREFUSED / ENOTFOUND / fetch failed 等网络类
    if (
      /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(
        raw,
      )
    ) {
      return failure(`对象存储连接失败：${raw} · ${reachHints.join(" · ")}`);
    }
    if (/InvalidBucketName/i.test(raw) || /SecondLevelDomainForbidden/i.test(raw)) {
      reachHints.unshift(
        "阿里云 OSS 请使用公网区域 endpoint（如 https://oss-cn-beijing.aliyuncs.com）；Habitat 会自动改写为 bucket.oss-… 虚拟托管地址",
      );
    }
    if (/AccessDenied|ListBuckets/i.test(raw)) {
      reachHints.unshift(
        "请确认 RAM 对该 bucket 有 oss:PutObject / oss:GetObject（测试连接不再需要 ListBuckets）",
      );
    }
    return failure(`对象存储连接失败：${formatS3ClientError(err, reachHints)}`);
  }
}

async function testWeixin(draft: Record<string, unknown>): Promise<ConfigTestConnectionResult> {
  const saved = asRecord(runtimeConfig().weixin);
  if (draft.enabled === false || (draft.enabled === undefined && saved.enabled === false)) {
    return failure("微信网关已禁用");
  }
  let token = "";
  try {
    token = await resolveConfigString(draft.token, saved.token);
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
  if (!token) {
    const envToken = process.env.WEIXIN_ILINK_TOKEN?.trim() ?? "";
    token = envToken;
  }
  if (!token) return failure("请填写 weixin.token、env/vault 引用，或设置 WEIXIN_ILINK_TOKEN");

  const baseUrl = pickConfigString(draft.base_url, saved.base_url);
  const started = Date.now();
  try {
    const { base_url } = await probeWeixinIlinkToken(token, baseUrl || undefined);
    return success("微信 iLink 连接成功", Date.now() - started, { base_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure(`微信连接失败：${msg}`);
  }
}

export async function testConfigConnection(
  input: ConfigTestConnectionInput,
): Promise<ConfigTestConnectionResult> {
  const parsed = configTestConnectionInputSchema.parse(input);
  const draft = parsed.config ?? {};

  switch (parsed.service) {
    case "firecrawl":
      return testFirecrawl(draft);
    case "camofox": {
      const camofox = asRecord(draft.camofox);
      const flat =
        Object.keys(camofox).length > 0 ? camofox : draft.base_url !== undefined ? draft : camofox;
      return testCamofox(flat);
    }
    case "embedding":
      return testEmbedding(draft);
    case "llm_provider": {
      if (!parsed.provider_id?.trim()) {
        throw new ApiHandlerError(400, "provider_id 必填", { code: "provider_id_required" });
      }
      return testLlmProvider(parsed.provider_id.trim(), draft);
    }
    case "discord":
      return testDiscord(draft);
    case "weixin":
      return testWeixin(draft);
    case "object_storage":
      return testObjectStorage(draft);
    default:
      throw new ApiHandlerError(400, `未知服务：${parsed.service satisfies never}`);
  }
}
