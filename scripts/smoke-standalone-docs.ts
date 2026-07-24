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

import { ToolSetRegistry } from "@freeanima/core/tool";
import { resetRepoRootForTests } from "@freeanima/core/config/repo-root";

import { registerDocsTools } from "@freeanima/capabilities/tools/docs";
import {
  resetDocsCorpusCacheForTest,
  setDocsCorpusForTest,
} from "@freeanima/capabilities/tools/docs-corpus";
import {
  registerEmbeddedDocs,
  resetEmbeddedDocsForTest,
} from "@freeanima/capabilities/tools/docs-embedded";
import { listDocsEmbeds } from "./standalone-docs-embeds.ts";

const ROOT = join(import.meta.dir, "..");
const BIN = join(ROOT, "dist/anima-executable/anima");
const STANDALONE_ROOT = join(ROOT, "dist/anima-executable");
const DOCS_DIR = join(ROOT, "docs");
const DOC_NEEDLE = "System-level constraints and long-lived design principles";
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
        const body = (await res.json()) as { status?: string };
        if (body.status === "ok") return;
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
  const embeds = listDocsEmbeds(DOCS_DIR);
  console.log(`ok: docs embed manifest ${embeds.length} file(s)`);

  const prevRepoRoot = process.env.FREEANIMA_REPO_ROOT;
  process.env.FREEANIMA_REPO_ROOT = STANDALONE_ROOT;
  resetRepoRootForTests();
  resetEmbeddedDocsForTest();
  resetDocsCorpusCacheForTest();
  setDocsCorpusForTest(null);

  registerEmbeddedDocs(
    embeds.map((e) => ({
      rel: e.rel,
      path: e.absPath,
    })),
  );

  const registry = new ToolSetRegistry();
  registerDocsTools(registry);

  const list = JSON.parse(await requireTool(registry, "docs_list").handler({}));
  if (list.total !== embeds.length) {
    throw new Error(`docs_list total=${list.total}, expected ${embeds.length}`);
  }
  if (!list.docs.some((d: { path: string }) => d.path === "concepts/architecture.md")) {
    throw new Error("docs_list missing concepts/architecture.md");
  }

  const get = JSON.parse(
    await requireTool(registry, "docs_get").handler({ path: "concepts/architecture.md" }),
  );
  if (!String(get.content).includes(DOC_NEEDLE)) {
    throw new Error("docs_get content missing expected architecture marker");
  }

  const search = JSON.parse(
    await requireTool(registry, "docs_search").handler({ query: "Habitat Portal" }),
  );
  if (search.total < 1) {
    throw new Error(`docs_search expected hits, got total=${search.total}`);
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
    const body = (await res.json()) as {
      tools?: { items?: Array<{ name: string }> };
    };
    const names = new Set((body.tools?.items ?? []).map((t) => t.name));
    for (const n of ["docs_list", "docs_get", "docs_search"]) {
      if (!names.has(n)) throw new Error(`live standalone missing tool ${n}`);
    }
    console.log("ok: live standalone registers docs_list/docs_get/docs_search");
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
