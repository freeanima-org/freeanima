#!/usr/bin/env bun
/**
 * Sample anima service process RSS (VmRSS) and /status snapshot.
 *
 *   bun run memory:sample -- --label idle
 *   bun run memory:sample -- --pid 12345 --label after-chat
 *   bun run memory:sample -- --url http://127.0.0.1:2658/status
 */

import { readFileSync } from "node:fs";

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

function parseArgs(argv: string[]): { pid: number; label: string; url: string | null } {
  let pid = process.pid;
  let label = "";
  let url: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pid" && argv[i + 1]) {
      pid = parseInt(argv[++i]!, 10);
    } else if (arg === "--label" && argv[i + 1]) {
      label = argv[++i]!;
    } else if (arg === "--url" && argv[i + 1]) {
      url = argv[++i]!;
    }
  }
  return { pid, label, url };
}

async function fetchStatus(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const { pid, label, url } = parseArgs(process.argv.slice(2));
const rssKb = readRssKb(pid);
const rssMb = (rssKb / 1024).toFixed(1);

const parts: string[] = [];
if (label) parts.push(`label=${label}`);
parts.push(`pid=${pid}`);
parts.push(`rss_kb=${rssKb}`);
parts.push(`rss_mb=${rssMb}`);

if (url) {
  const status = await fetchStatus(url);
  if (status) {
    if (typeof status.memory_kb === "number") {
      parts.push(`status_memory_kb=${status.memory_kb}`);
    }
    const sessions = status.sessions as { total?: number } | undefined;
    if (sessions?.total != null) {
      parts.push(`sessions=${sessions.total}`);
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
