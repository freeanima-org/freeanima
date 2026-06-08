import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { fileURLToPath } from "node:url";

const docsRoot = fileURLToPath(new URL("../../docs", import.meta.url));

function docsEntryId(entry: string): string {
  let id = entry.replace(/\.(md|mdx)$/i, "");
  if (/^readme$/i.test(id)) return "docs";
  id = id.replace(/\/readme$/i, "");
  return id ? `docs/${id}` : "docs";
}

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: docsRoot,
      pattern: "**/*.{md,mdx}",
      generateId: ({ entry }) => docsEntryId(entry),
    }),
    schema: docsSchema(),
  }),
};
