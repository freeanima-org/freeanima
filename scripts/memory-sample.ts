#!/usr/bin/env bun
/**
 * Sample anima service process RSS (VmRSS) and Hub RPC status.get snapshot.
 *
 *   just memory-sample -- --label idle
 *   just memory-sample -- --pid 12345 --label after-chat
 *   just memory-sample -- --hub-url http://127.0.0.1:2658
 *   just memory-sample -- --hub-url http://127.0.0.1:2658 --stage full
 */

import { readFileSync } from "node:fs";

import { fetchHubRestRaw, parseHubRestResponse } from "@freeanima/shared/hub-rpc";

type MemoryDetail = {
  rss_kb?: number;
  vm_size_kb?: number;
  heap_used_kb?: number;
  heap_total_kb?: number;
  external_kb?: number;
  array_buffers_kb?: number;
  tokenizer_repos?: string[];
  jieba_loaded?: boolean;
  mcp?: { server_count?: number; connected_count?: number };
  acp?: { agent_count?: number; connected_count?: number };
};

function readRssKb(pid: number): number {
  try {
    const statusText = readFileSync(`/proc/${pid}/status`, "utf-8");
    for (const line of statusText.split("\n")) {
      if (line.startsWith("VmRSS:")) {
        return parseInt(line.split(/\s+/)[1] ?? "0", 10);
      }
    }
  } catch {
    /* non-Linux or missing pid */
  }
  return 0;
}

function parseArgs(argv: string[]): {
  pid: number;
  label: string;
  hubUrl: string | null;
  stage: string;
} {
  let pid = process.pid;
  let label = "";
  let hubUrl: string | null = null;
  let stage = "basic";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pid" && argv[i + 1]) {
      const pidArg = argv[++i];
      if (pidArg !== undefined) pid = parseInt(pidArg, 10);
    } else if (arg === "--label" && argv[i + 1]) {
      const labelArg = argv[++i];
      if (labelArg !== undefined) label = labelArg;
    } else if ((arg === "--hub-url" || arg === "--url") && argv[i + 1]) {
      const urlArg = argv[++i];
      if (urlArg !== undefined) hubUrl = urlArg.replace(/\/api\/status\/?$/, "");
    } else if (arg === "--stage" && argv[i + 1]) {
      const stageArg = argv[++i];
      if (stageArg !== undefined) stage = stageArg;
    }
  }
  return { pid, label, hubUrl, stage };
}

async function fetchStatusViaHubRpc(
  hubUrl: string,
  token?: string,
): Promise<Record<string, unknown> | null> {
  const bearer = token?.trim() || process.env.FREEANIMA_REMOTE_AUTH_TOKEN?.trim();
  try {
    const options = bearer ? { authToken: bearer } : undefined;
    const res = await fetchHubRestRaw(hubUrl, "status.get", {}, options);
    return (await parseHubRestResponse(res)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function appendMemoryDetail(
  parts: string[],
  detail: MemoryDetail | undefined,
  stage: string,
): void {
  if (!detail || stage === "basic") return;
  if (detail.heap_used_kb != null) parts.push(`heap_used_kb=${detail.heap_used_kb}`);
  if (detail.vm_size_kb != null) parts.push(`vm_size_kb=${detail.vm_size_kb}`);
  if (detail.external_kb != null) parts.push(`external_kb=${detail.external_kb}`);
  if (detail.tokenizer_repos) {
    parts.push(`tokenizer_repos=${detail.tokenizer_repos.length}`);
    parts.push(`tokenizer_repos_list=${detail.tokenizer_repos.join(",")}`);
  }
  if (detail.jieba_loaded != null) parts.push(`jieba_loaded=${detail.jieba_loaded}`);
  if (detail.mcp?.connected_count != null) {
    parts.push(`mcp_connected=${detail.mcp.connected_count}`);
  }
  if (detail.acp?.connected_count != null) {
    parts.push(`acp_connected=${detail.acp.connected_count}`);
  }
}

const { pid, label, hubUrl, stage } = parseArgs(process.argv.slice(2));
const rssKb = readRssKb(pid);
const rssMb = (rssKb / 1024).toFixed(1);

const parts: string[] = [];
if (label) parts.push(`label=${label}`);
if (stage !== "basic") parts.push(`stage=${stage}`);
parts.push(`pid=${pid}`);
parts.push(`rss_kb=${rssKb}`);
parts.push(`rss_mb=${rssMb}`);

if (hubUrl) {
  const status = await fetchStatusViaHubRpc(hubUrl);
  if (status) {
    if (typeof status.memory_kb === "number") {
      parts.push(`status_memory_kb=${status.memory_kb}`);
    }
    appendMemoryDetail(parts, status.memory_detail as MemoryDetail | undefined, stage);
    const conversations = status.conversations as { total?: number } | undefined;
    if (conversations?.total != null) {
      parts.push(`conversations=${conversations.total}`);
    }
    if (typeof status.tools === "number") {
      parts.push(`tools=${status.tools}`);
    }
    if (typeof status.uptime_seconds === "number") {
      parts.push(`uptime_s=${status.uptime_seconds}`);
    }
  }
}

console.log(parts.join(" "));
