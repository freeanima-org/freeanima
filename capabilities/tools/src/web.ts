import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/engine-tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { credential, loadConfig, readAppVersion } from "@freeanima/service-config";

const USER_AGENT = `anima/${readAppVersion()}`;
const HTTP_TIMEOUT_MS = 60_000;
const MAX_EXTRACT_URLS = 5;
const MAX_SEARCH_LIMIT = 20;

type FirecrawlConfig = { apiUrl: string; apiKey: string };

function getFirecrawlConfig(): FirecrawlConfig {
  const cfg = loadConfig() as Record<string, unknown>;
  const fc = (cfg.firecrawl as Record<string, unknown> | undefined) ?? {};
  const apiUrl = (fc.api_url as string) || "https://api.firecrawl.dev";
  let apiKey = "";
  try {
    apiKey = credential("services/firecrawl", "token");
  } catch {
    /* optional */
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

function checkConfig(): string | null {
  const cfg = getFirecrawlConfig();
  if (!cfg.apiUrl && !cfg.apiKey) {
    return "未配置 Firecrawl。请设置 firecrawl.api_url 或 credential services/firecrawl。";
  }
  return null;
}

function headers(cfg: FirecrawlConfig): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
  };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  return h;
}

async function handleWebSearch(query: string, limit = 5): Promise<string> {
  const err = checkConfig();
  if (err) return toolError(err);
  if (!query?.trim()) return toolError("query is required");

  const cap = Math.max(1, Math.min(limit, MAX_SEARCH_LIMIT));
  const cfg = getFirecrawlConfig();
  const url = `${cfg.apiUrl}/v1/search`;

  let data: Record<string, unknown>;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify({ query: query.trim(), limit: cap }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!resp.ok) return toolError(`搜索请求失败: HTTP ${resp.status}`);
    data = (await resp.json()) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("timeout")) {
      return toolError("搜索请求超时");
    }
    return toolError(`搜索请求失败: ${msg}`);
  }

  const results: Array<{ title: string; url: string; description: string }> = [];
  const rawData = data.data;
  if (Array.isArray(rawData)) {
    for (const item of rawData) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      results.push({
        title: String(row.title ?? ""),
        url: String(row.url ?? row.link ?? ""),
        description: String(row.description ?? row.snippet ?? ""),
      });
    }
  } else if (rawData && typeof rawData === "object") {
    const web = (rawData as Record<string, unknown>).web;
    if (Array.isArray(web)) {
      for (const item of web) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        results.push({
          title: String(row.title ?? ""),
          url: String(row.url ?? row.link ?? ""),
          description: String(row.description ?? row.snippet ?? ""),
        });
      }
    }
  }

  return toolResult({ results, total: results.length });
}

async function handleWebExtract(urls: string[]): Promise<string> {
  const err = checkConfig();
  if (err) return toolError(err);
  if (!urls?.length) return toolError("urls list is required");

  const cfg = getFirecrawlConfig();
  const baseUrl = `${cfg.apiUrl}/v1/scrape`;
  const hdrs = headers(cfg);
  const results: Array<{
    url: string;
    title: string;
    content: string;
    error: string | null;
  }> = [];

  for (const raw of urls.slice(0, MAX_EXTRACT_URLS)) {
    const url = raw?.trim() ?? "";
    if (!url) {
      results.push({ url: raw, title: "", content: "", error: "空 URL" });
      continue;
    }

    try {
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!resp.ok) {
        results.push({ url, title: "", content: "", error: `HTTP ${resp.status}` });
        continue;
      }
      const data = (await resp.json()) as Record<string, unknown>;
      const payload = data.data ?? data;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const row = payload as Record<string, unknown>;
        const title = String(row.title ?? "");
        let content = String(row.markdown ?? row.content ?? row.text ?? "");
        const maxChars = 100_000;
        if (content.length > maxChars) {
          content = `${content.slice(0, maxChars)}\n\n[...截断：超过 ${maxChars} 字符]`;
        }
        results.push({ url, title, content, error: null });
      } else {
        results.push({ url, title: "", content: "", error: "无法解析响应" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        url,
        title: "",
        content: "",
        error: msg.includes("abort") || msg.includes("timeout") ? "请求超时" : msg,
      });
    }
  }

  return toolResult({ results });
}

export function registerWebTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "web",
    "网页搜索与内容提取",
    attachToolReturns(
      [
        {
          name: "web_search",
          description: "Search the web via Firecrawl",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              limit: { type: "integer", default: 5, minimum: 1, maximum: MAX_SEARCH_LIMIT },
            },
            required: ["query"],
          },
          handler: (a) => handleWebSearch(String(a.query), Number(a.limit ?? 5)),
        },
        {
          name: "web_extract",
          description: "Fetch URLs and extract content via Firecrawl",
          parameters: {
            type: "object",
            properties: {
              urls: { type: "array", items: { type: "string" }, maxItems: MAX_EXTRACT_URLS },
            },
            required: ["urls"],
          },
          handler: (a) => {
            const urls = Array.isArray(a.urls) ? a.urls.map(String) : [];
            return handleWebExtract(urls);
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
