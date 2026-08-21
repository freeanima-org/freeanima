#!/usr/bin/env bun
/**
 * standalone 打包冒烟：docs 嵌入 + 无磁盘 docs/ 时 docs_* 工具可读。
 *
 * 用法（在 just pack cli 之后）：
 *   bun scripts/smoke-standalone-docs.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { resetRepoRootForTests } from "@freeanima/habitat/core/config/repo-root";

import { registerDocsTools } from "@freeanima/habitat/capabilities/tools/docs";
import {
  resetDocsCorpusCacheForTest,
  setDocsCorpusForTest,
} from "@freeanima/habitat/capabilities/tools/docs-corpus";
import {
  registerEmbeddedDocs,
  resetEmbeddedDocsForTest,
} from "@freeanima/habitat/capabilities/tools/docs-embedded";
import { listEmbeddedDocsFromDir } from "@freeanima/habitat/capabilities/tools/docs-dir-import";
import { asRecord } from "@freeanima/shared/util";

const ROOT = join(import.meta.dir, "..");
const BIN = join(ROOT, "dist/anima-executable/anima");
const STANDALONE_ROOT = join(ROOT, "dist/anima-executable");
const DOC_NEEDLE = "系统级约束与长期设计原则";
const SMOKE_PORT = 18_659;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requireTool(registry: ToolSetRegistry, name: string) {
  const tool = registry.getTool(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function parseDocsList(raw: unknown): { total: number; docs: { path: string }[] } {
  if (raw == null || typeof raw !== "object") {
    throw new Error("freeanima_docs_list 返回非对象");
  }
  const total: unknown = Reflect.get(raw, "total");
  const docsRaw: unknown = Reflect.get(raw, "docs");
  if (typeof total !== "number" || !Array.isArray(docsRaw)) {
    throw new Error("freeanima_docs_list 结构无效");
  }
  const docs = docsRaw.flatMap((entry) => {
    if (entry == null || typeof entry !== "object") return [];
    const path: unknown = Reflect.get(entry, "path");
    return typeof path === "string" ? [{ path }] : [];
  });
  return { total, docs };
}

function parseDocsGet(raw: unknown): { content: string } {
  if (raw == null || typeof raw !== "object") {
    throw new Error("freeanima_docs_get 返回非对象");
  }
  const content: unknown = Reflect.get(raw, "content");
  if (typeof content !== "string") {
    throw new Error("freeanima_docs_get 缺少 content");
  }
  return { content };
}

function parseDocsSearch(raw: unknown): { total: number } {
  if (raw == null || typeof raw !== "object") {
    throw new Error("freeanima_docs_search 返回非对象");
  }
  const total: unknown = Reflect.get(raw, "total");
  if (typeof total !== "number") {
    throw new Error("freeanima_docs_search 缺少 total");
  }
  return { total };
}

function parseJson(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

function stopChild(child: ChildProcess | null): void {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

async function waitForHealth(port: number, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/rpc/v1/health/probe`);
      if (res.ok) {
        const body = asRecord(await res.json());
        if (body?.status === "ok") return;
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(500);
  }
  throw new Error(`health check timed out: ${String(lastError)}`);
}

function assertBinaryHasEmbeddedDocs(): void {
  if (!existsSync(BIN)) {
    throw new Error(`missing ${BIN}; run just pack cli first`);
  }
  const blob = readFileSync(BIN);
  if (!blob.includes(DOC_NEEDLE)) {
    throw new Error(`binary missing embedded docs marker: ${DOC_NEEDLE}`);
  }
  console.log(`ok: binary contains embedded docs marker (${DOC_NEEDLE.slice(0, 40)}…)`);
}

async function assertEmbeddedCorpusWithoutDiskDocs(): Promise<void> {
  const embeds = listEmbeddedDocsFromDir();
  console.log(`ok: docs dir: embed manifest ${embeds.length} file(s)`);

  const prevRepoRoot = process.env.FREEANIMA_REPO_ROOT;
  process.env.FREEANIMA_REPO_ROOT = STANDALONE_ROOT;
  resetRepoRootForTests();
  resetEmbeddedDocsForTest();
  resetDocsCorpusCacheForTest();
  setDocsCorpusForTest(null);

  registerEmbeddedDocs(embeds);

  const registry = new ToolSetRegistry();
  registerDocsTools(registry);

  const list = parseDocsList(
    parseJson(await requireTool(registry, "freeanima_docs_list").handler({})),
  );
  if (list.total !== embeds.length) {
    throw new Error(`freeanima_docs_list total=${list.total}, expected ${embeds.length}`);
  }
  if (!list.docs.some((d) => d.path === "product/architecture.md")) {
    throw new Error("freeanima_docs_list missing product/architecture.md");
  }

  const get = parseDocsGet(
    parseJson(
      await requireTool(registry, "freeanima_docs_get").handler({
        path: "product/architecture.md",
      }),
    ),
  );
  if (!get.content.includes(DOC_NEEDLE)) {
    throw new Error("freeanima_docs_get content missing expected architecture marker");
  }

  const search = parseDocsSearch(
    parseJson(
      await requireTool(registry, "freeanima_docs_search").handler({ query: "Habitat Portal" }),
    ),
  );
  if (search.total < 1) {
    throw new Error(`freeanima_docs_search expected hits, got total=${search.total}`);
  }

  console.log(
    `ok: embedded corpus without disk docs/ (list=${list.total}, search=${search.total})`,
  );

  resetEmbeddedDocsForTest();
  resetDocsCorpusCacheForTest();
  setDocsCorpusForTest(null);
  resetRepoRootForTests();
  if (prevRepoRoot === undefined) delete process.env.FREEANIMA_REPO_ROOT;
  else process.env.FREEANIMA_REPO_ROOT = prevRepoRoot;
}

async function assertLiveStandaloneRegistersDocsTools(): Promise<void> {
  const dbUrl = process.env.ANIMA_TEST_PG_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.log("skip: live standalone service (no ANIMA_TEST_PG_URL / DATABASE_URL)");
    return;
  }

  const prevHome = process.env.FREEANIMA_HOME;
  const home = join(ROOT, "dist", "anima-executable", ".smoke-docs-home");
  process.env.FREEANIMA_HOME = home;

  let child: ChildProcess | null = null;
  try {
    child = spawn(BIN, ["service", "start", "--foreground", "--port", String(SMOKE_PORT)], {
      env: {
        ...process.env,
        FREEANIMA_HOME: home,
        FREEANIMA_REPO_ROOT: STANDALONE_ROOT,
        DATABASE_URL: dbUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    await waitForHealth(SMOKE_PORT);

    const tokenPath = join(home, "dev-web.token");
    if (!existsSync(tokenPath)) {
      throw new Error(`missing ${tokenPath} after standalone start`);
    }
    const token = readFileSync(tokenPath, "utf8").trim();

    const res = await fetch(`http://127.0.0.1:${SMOKE_PORT}/rpc/v1/prompt/debug`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`prompt.debug failed: HTTP ${res.status}`);
    }
    const body = asRecord(await res.json());
    const tools = asRecord(body?.tools);
    const items = Array.isArray(tools?.items) ? tools.items : [];
    const names = new Set(
      items
        .map((t) => asRecord(t))
        .filter((t): t is Record<string, unknown> => t != null && typeof t.name === "string")
        .map((t) => String(t.name)),
    );
    for (const n of ["freeanima_docs_list", "freeanima_docs_get", "freeanima_docs_search"]) {
      if (!names.has(n)) throw new Error(`live standalone missing tool ${n}`);
    }
    console.log("ok: live standalone registers freeanima_docs_* tools");
  } finally {
    stopChild(child);
    await sleep(300);
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  }
}

async function main(): Promise<void> {
  assertBinaryHasEmbeddedDocs();
  await assertEmbeddedCorpusWithoutDiskDocs();
  await assertLiveStandaloneRegistersDocsTools();
  console.log("smoke-standalone-docs: passed");
}

await main();
