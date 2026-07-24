import { afterEach, describe, expect, it, mock } from "bun:test";

import { resetResolveContextForTest, setResolveContext } from "./resolve-context.ts";
import { buildSearchQueries, deriveBaseModelNames, stripOllamaTag } from "./normalize.ts";
import {
  generateCandidateRepos,
  resolveTokenizerRepoWithMeta,
  searchHubForTokenizerRepo,
} from "./resolve.ts";
import {
  isLikelyHubRepo,
  ollamaApiBaseFromOpenAiUrl,
  resolveOllamaModelHints,
} from "./resolve-ollama.ts";
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

describe("deriveBaseModelNames", () => {
  it("strips quantization suffix for bge-m3-4t", () => {
    expect(deriveBaseModelNames("bge-m3-4t")).toEqual(["bge-m3-4t", "bge-m3"]);
  });

  it("strips ollama tag before suffix stripping", () => {
    expect(deriveBaseModelNames("bge-m3-4t:latest")).toEqual(["bge-m3-4t", "bge-m3"]);
  });
});

describe("buildSearchQueries", () => {
  it("includes base name without tag", () => {
    const queries = buildSearchQueries("qwen2.5:7b");
    expect(queries).toContain("qwen2.5");
    expect(queries).toContain("qwen2.5:7b");
  });
  it("includes derived base name for quantized variants", () => {
    const queries = buildSearchQueries("bge-m3-4t");
    expect(queries).toContain("bge-m3");
    expect(queries).toContain("bge-m3-4t");
  });
});

describe("isLikelyHubRepo", () => {
  it("accepts org/repo", () => {
    expect(isLikelyHubRepo("BAAI/bge-m3")).toBe(true);
  });

  it("rejects local blob paths", () => {
    expect(isLikelyHubRepo("/usr/share/ollama/.ollama/models/blobs/sha256-abc")).toBe(false);
  });
});

describe("ollamaApiBaseFromOpenAiUrl", () => {
  it("strips trailing slashes and /v1 suffix", () => {
    expect(ollamaApiBaseFromOpenAiUrl("http://127.0.0.1:11434/v1///")).toBe(
      "http://127.0.0.1:11434",
    );
  });

  it("recognizes ollama port without /v1", () => {
    expect(ollamaApiBaseFromOpenAiUrl("http://localhost:11434/")).toBe("http://localhost:11434");
  });

  it("returns null for unrelated URLs", () => {
    expect(ollamaApiBaseFromOpenAiUrl("https://api.openai.com")).toBeNull();
    expect(ollamaApiBaseFromOpenAiUrl("https://opencode.ai/zen/go/v1")).toBeNull();
  });
});

describe("resolveOllamaModelHints", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("filters blob paths and keeps hub repos from modelfile", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/api/show")) {
        return new Response(
          JSON.stringify({
            modelfile: "FROM BAAI/bge-m3",
            model_info: {
              "general.basename": "/usr/share/ollama/.ollama/models/blobs/sha256-abc",
            },
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });

    const hints = await resolveOllamaModelHints("bge-m3-4t", ["http://127.0.0.1:11434/v1"]);
    expect(hints).toEqual(["BAAI/bge-m3"]);
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

  it("resolves bge-m3-4t via seed fallback to BAAI/bge-m3", async () => {
    process.env.FREEANIMA_HOME = testHome;
    mkdirSync(dirname(getRegistryPath()), { recursive: true });
    setResolveContext({ ollamaBaseUrls: [] });

    mockFetch(async (url, init) => {
      if (init?.method === "HEAD" && /BAAI\/bge-m3\/resolve\//.test(url)) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const { repo, meta } = await resolveTokenizerRepoWithMeta("bge-m3-4t");
    expect(repo).toBe("BAAI/bge-m3");
    expect(meta.candidatesTried).toContain("BAAI/bge-m3");
    expect(loadUserRegistry()["bge-m3-4t"]).toBe("BAAI/bge-m3");
  });
});
