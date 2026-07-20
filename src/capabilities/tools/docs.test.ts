import { describe, it, expect, afterEach } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";

import {
  buildCorpusFromEntries,
  extractDocTitle,
  getDoc,
  listDocs,
  normalizeDocsPath,
  searchDocs,
  setDocsCorpusForTest,
} from "./docs-corpus.ts";
import { registerDocsTools } from "./docs.ts";
import { resetEmbeddedDocsForTest } from "./docs-embedded.ts";

const SAMPLE = buildCorpusFromEntries([
  {
    path: "concepts/architecture.md",
    body: "---\ntitle: Architecture\n---\n\n# FreeAnima Architecture\n\nHabitat and Portal naming.\n",
  },
  {
    path: "concepts/memory.md",
    body: "---\ntitle: Memory\n---\n\n# Memory\n\nSemantic memory and FTS retrieval pipeline.\n",
  },
  {
    path: "guide/install.md",
    body: "# Installation\n\nHow to install FreeAnima.\n",
  },
]);

describe("docs corpus helpers", () => {
  it("extractDocTitle prefers frontmatter", () => {
    expect(extractDocTitle("---\ntitle: Architecture\n---\n\n# Other\n", "x.md")).toBe(
      "Architecture",
    );
  });

  it("extractDocTitle falls back to heading then basename", () => {
    expect(extractDocTitle("# Installation\n\nbody\n", "guide/install.md")).toBe("Installation");
    expect(extractDocTitle("no title here\n", "guide/install.md")).toBe("install");
  });

  it("normalizeDocsPath rejects traversal and absolute", () => {
    expect(normalizeDocsPath("concepts/architecture.md")).toBe("concepts/architecture.md");
    expect(normalizeDocsPath("../secrets")).toBeNull();
    expect(normalizeDocsPath("/etc/passwd")).toBeNull();
    expect(normalizeDocsPath(".generated/zh.md")).toBeNull();
    expect(normalizeDocsPath("")).toBeNull();
  });

  it("listDocs sorts by path", () => {
    const listed = listDocs(SAMPLE);
    expect(listed.map((d) => d.path)).toEqual([
      "concepts/architecture.md",
      "concepts/memory.md",
      "guide/install.md",
    ]);
    expect(listed[0]?.title).toBe("Architecture");
  });

  it("getDoc returns content or error", () => {
    const ok = getDoc(SAMPLE, "concepts/memory.md");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.title).toBe("Memory");
      expect(ok.content).toContain("Semantic memory");
    }
    const bad = getDoc(SAMPLE, "../x.md");
    expect(bad.ok).toBe(false);
    const missing = getDoc(SAMPLE, "missing.md");
    expect(missing.ok).toBe(false);
  });

  it("searchDocs AND match with snippet", () => {
    const result = searchDocs(SAMPLE, "memory FTS");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.total).toBe(1);
    expect(result.hits[0]?.path).toBe("concepts/memory.md");
    expect(result.hits[0]?.snippet.length).toBeGreaterThan(0);

    const empty = searchDocs(SAMPLE, "   ");
    expect("error" in empty).toBe(true);
  });
});

describe("docs tools", () => {
  afterEach(() => {
    setDocsCorpusForTest(null);
    resetEmbeddedDocsForTest();
  });

  it("registers and serves list/get/search from injected corpus", async () => {
    setDocsCorpusForTest(SAMPLE);
    const registry = new ToolSetRegistry();
    registerDocsTools(registry);

    const names = new Set(registry.listTools().map((t) => t.name));
    expect(names.has("docs_list")).toBe(true);
    expect(names.has("docs_get")).toBe(true);
    expect(names.has("docs_search")).toBe(true);

    const listOut = JSON.parse(await registry.getTool("docs_list")!.handler({}));
    expect(listOut.total).toBe(3);
    expect(listOut.docs[0].path).toBe("concepts/architecture.md");

    const getOut = JSON.parse(
      await registry.getTool("docs_get")!.handler({ path: "concepts/architecture.md" }),
    );
    expect(getOut.title).toBe("Architecture");
    expect(getOut.content).toContain("Habitat and Portal");

    const searchOut = JSON.parse(
      await registry.getTool("docs_search")!.handler({ query: "Portal naming" }),
    );
    expect(searchOut.total).toBe(1);
    expect(searchOut.hits[0].path).toBe("concepts/architecture.md");

    const errOut = JSON.parse(
      await registry.getTool("docs_get")!.handler({ path: "../../etc/passwd" }),
    );
    expect(errOut.error).toBeDefined();
  });
});
