import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

import type { LocomoQa, LocomoSample } from "./types.ts";
import { asString } from "./coerce.ts";

const DEFAULT_URL =
  "https://raw.githubusercontent.com/snap-research/locomo/main/data/locomo10.json";

export function defaultCachePath(repoRoot: string): string {
  return path.join(repoRoot, ".cache", "locomo", "locomo10.json");
}

export function fixturePath(repoRoot: string): string {
  return path.join(repoRoot, "scripts", "eval", "locomo", "fixtures", "mini.json");
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function normalizeQa(raw: unknown): LocomoQa[] {
  if (typeof raw === "string") {
    return normalizeQa(JSON.parse(raw) as unknown);
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const q = item as Record<string, unknown>;
    const out: LocomoQa = {
      question: asString(q.question),
      category: Number(q.category ?? 0),
    };
    if (q.answer != null) out.answer = asString(q.answer);
    if (Array.isArray(q.evidence)) out.evidence = q.evidence.map((e) => asString(e));
    return out;
  });
}

/** 解析 LoCoMo JSON（官方数组或 fixture） */
export function parseLocomoData(raw: unknown): LocomoSample[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((item) => {
    const s = item as Record<string, unknown>;
    return {
      sample_id: asString(s.sample_id ?? s.sampleId, "unknown"),
      conversation: (s.conversation ?? {}) as Record<string, unknown>,
      qa: normalizeQa(s.qa),
    };
  });
}

export async function loadLocomoJson(filePath: string): Promise<LocomoSample[]> {
  const text = await readFile(filePath, "utf8");
  return parseLocomoData(JSON.parse(text) as unknown);
}

/** 拉取官方 locomo10.json 到缓存；已存在则复用 */
export async function fetchLocomoData(opts: {
  repoRoot: string;
  url?: string;
  cachePath?: string;
  force?: boolean;
}): Promise<{ path: string; samples: LocomoSample[] }> {
  const cachePath = opts.cachePath ?? defaultCachePath(opts.repoRoot);
  await mkdir(path.dirname(cachePath), { recursive: true });
  if (!opts.force && (await exists(cachePath))) {
    return { path: cachePath, samples: await loadLocomoJson(cachePath) };
  }
  const url = opts.url ?? DEFAULT_URL;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch LoCoMo failed: ${res.status} ${res.statusText} (${url})`);
  }
  const text = await res.text();
  // validate
  parseLocomoData(JSON.parse(text) as unknown);
  await writeFile(cachePath, text, "utf8");
  return { path: cachePath, samples: await loadLocomoJson(cachePath) };
}

export async function loadFixture(repoRoot: string): Promise<LocomoSample[]> {
  return loadLocomoJson(fixturePath(repoRoot));
}
