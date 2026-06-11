import { afterEach, describe, expect, it, mock } from "bun:test";

import { resetResolveContextForTest } from "./resolve-context.ts";
import { buildSearchQueries, stripOllamaTag } from "./normalize.ts";
import {
  generateCandidateRepos,
  resolveTokenizerRepoWithMeta,
  searchHubForTokenizerRepo,
} from "./resolve.ts";
import { deleteRegistryEntry, loadUserRegistry, saveRegistryEntry } from "./registry.ts";
import { getRegistryPath } from "./paths.ts";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): void {
  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as unknown as typeof fetch;
}

describe("stripOllamaTag", () => {
  it("strips tag suffix", () => {
    expect(stripOllamaTag("qwen2.5:7b")).toBe("qwen2.5");
  });
});

describe("buildSearchQueries", () => {
  it("includes base name without tag", () => {
    const queries = buildSearchQueries("qwen2.5:7b");
    expect(queries).toContain("qwen2.5");
    expect(queries).toContain("qwen2.5:7b");
  });
});

describe("generateCandidateRepos", () => {
  it("bge-m3 includes BAAI/bge-m3", () => {
    expect(generateCandidateRepos("bge-m3")).toContain("BAAI/bge-m3");
  });

  it("qwen prefix includes Qwen org", () => {
    expect(generateCandidateRepos("qwen2.5:7b")).toContain("Qwen/qwen2.5");
  });
});

describe("searchHubForTokenizerRepo", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("resolves when list API has no siblings", async () => {
    mockFetch(async (url, init) => {
      if (url.includes("/api/models?search=")) {
        return new Response(
          JSON.stringify([
            { id: "deepseek-ai/DeepSeek-V4-Flash" },
            { id: "other/repo-no-tokenizer" },
          ]),
          { status: 200 },
        );
      }
      if (init?.method === "HEAD" && url.includes("DeepSeek-V4-Flash")) {
        return new Response(null, { status: 200 });
      }
      if (init?.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 404 });
    });

    const repos = await searchHubForTokenizerRepo("deepseek-v4-flash");
    expect(repos).toEqual(["deepseek-ai/DeepSeek-V4-Flash"]);
  });
});

describe("resolveTokenizerRepoWithMeta", () => {
  const testHome = `${process.cwd()}/.test-tokenizer-resolve-${Date.now()}`;

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    resetResolveContextForTest();
    delete process.env.FREEANIMA_HOME;
    rmSync(testHome, { recursive: true, force: true });
  });

  it("uses HF search when heuristics fail", async () => {
    process.env.FREEANIMA_HOME = testHome;
    mkdirSync(dirname(getRegistryPath()), { recursive: true });

    mockFetch(async (url, init) => {
      if (url.includes("/api/models?search=")) {
        return new Response(JSON.stringify([{ id: "vendor/Some-Custom-Model" }]), {
          status: 200,
        });
      }
      if (init?.method === "HEAD" && url.includes("Some-Custom-Model")) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const { repo, meta } = await resolveTokenizerRepoWithMeta("some-custom-model");
    expect(repo).toBe("vendor/Some-Custom-Model");
    expect(meta.searchQueries.length).toBeGreaterThan(0);
    expect(loadUserRegistry()["some-custom-model"]).toBe("vendor/Some-Custom-Model");
  });

  it("clears stale user registry and re-resolves", async () => {
    process.env.FREEANIMA_HOME = testHome;
    mkdirSync(dirname(getRegistryPath()), { recursive: true });
    saveRegistryEntry("stale-model", "org/wrong-repo");

    mockFetch(async (url, init) => {
      if (url.includes("org/wrong-repo")) {
        return new Response(null, { status: 404 });
      }
      if (url.includes("/api/models?search=")) {
        return new Response(JSON.stringify([{ id: "org/good-repo" }]), { status: 200 });
      }
      if (init?.method === "HEAD" && url.includes("good-repo")) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const { repo } = await resolveTokenizerRepoWithMeta("stale-model");
    expect(repo).toBe("org/good-repo");
    expect(loadUserRegistry()["stale-model"]).toBe("org/good-repo");
    deleteRegistryEntry("stale-model");
  });
});
