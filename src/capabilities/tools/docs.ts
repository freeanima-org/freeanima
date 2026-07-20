import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";

import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { getDoc, listDocs, resolveDocsCorpus, searchDocs } from "./docs-corpus.ts";

export function registerDocsTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "docs",
    "FreeAnima product documentation (docs/): list, read, and keyword search",
    attachToolReturns(
      [
        {
          name: "docs_list",
          description:
            "List all FreeAnima product docs under docs/ (relative path + title). Use docs_get for full content; docs_search for keyword lookup.",
          parameters: { type: "object", properties: {} },
          handler: () => {
            const corpus = resolveDocsCorpus();
            if ("error" in corpus) return toolError(corpus.error);
            const docs = listDocs(corpus);
            return toolResult({ docs, total: docs.length });
          },
        },
        {
          name: "docs_get",
          description:
            "Get full Markdown content of a FreeAnima doc by relative path under docs/ (e.g. concepts/architecture.md).",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path under docs/, e.g. concepts/architecture.md",
              },
            },
            required: ["path"],
          },
          handler: (args) => {
            const corpus = resolveDocsCorpus();
            if ("error" in corpus) return toolError(corpus.error);
            const result = getDoc(corpus, String(args.path ?? ""));
            if (!result.ok) return toolError(result.error);
            return toolResult({
              path: result.path,
              title: result.title,
              content: result.content,
            });
          },
        },
        {
          name: "docs_search",
          description:
            "Keyword search FreeAnima docs (path, title, body). Space-separated terms are AND (case-insensitive substring). Returns path, title, snippet, match count.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keywords (AND)" },
              limit: {
                type: "number",
                description: "Max hits to return (default 20)",
              },
            },
            required: ["query"],
          },
          handler: (args) => {
            const corpus = resolveDocsCorpus();
            if ("error" in corpus) return toolError(corpus.error);
            const limitRaw = args.limit;
            const limit = limitRaw == null || limitRaw === "" ? undefined : Number(limitRaw);
            const result = searchDocs(
              corpus,
              String(args.query ?? ""),
              limit != null && Number.isFinite(limit) ? limit : undefined,
            );
            if ("error" in result) return toolError(result.error);
            return toolResult(result);
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
