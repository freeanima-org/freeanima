import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";

import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { getDoc, listDocs, resolveDocsCorpus, searchDocs } from "./docs-corpus.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export function registerDocsTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "freeanima_docs",
    "FreeAnima product documentation (docs/): list, read, and keyword search",
    attachToolReturns(
      [
        {
          name: "freeanima_docs_list",
          description:
            "List FreeAnima product docs under docs/ (relative path + title). Optional prefix filters by path (e.g. cognition/, tools/). Use freeanima_docs_get for full content; freeanima_docs_search for keyword lookup. README.md is listed first.",
          parameters: {
            type: "object",
            properties: {
              prefix: {
                type: "string",
                description: "Optional path prefix under docs/, e.g. cognition/ or tools/",
              },
            },
          },
          handler: (args) => {
            const corpus = resolveDocsCorpus();
            if ("error" in corpus) return toolError(corpus.error);
            const prefixRaw = args.prefix == null ? "" : coerceString(args.prefix);
            const docs = listDocs(corpus, prefixRaw.length > 0 ? prefixRaw : undefined);
            return toolResult({ docs, total: docs.length });
          },
        },
        {
          name: "freeanima_docs_get",
          description:
            "Get full Markdown content of a FreeAnima doc by relative path under docs/ (e.g. product/architecture.md).",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path under docs/, e.g. product/architecture.md",
              },
            },
            required: ["path"],
          },
          handler: (args) => {
            const corpus = resolveDocsCorpus();
            if ("error" in corpus) return toolError(corpus.error);
            const result = getDoc(corpus, coerceString(args.path ?? ""));
            if (!result.ok) return toolError(result.error);
            return toolResult({
              path: result.path,
              title: result.title,
              content: result.content,
            });
          },
        },
        {
          name: "freeanima_docs_search",
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
              coerceString(args.query ?? ""),
              limit != null && Number.isFinite(limit) ? limit : undefined,
            );
            if ("error" in result) return toolError(result.error);
            return toolResult(result);
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
    { visibility: "searchable" },
  );
}
