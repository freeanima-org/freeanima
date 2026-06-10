import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { fileURLToPath } from "node:url";

const docsRoot = fileURLToPath(new URL("../../docs", import.meta.url));
const docsZhRoot = fileURLToPath(new URL("../../docs/.generated/zh_CN", import.meta.url));

function docsEntryId(entry: string, localePrefix?: string): string {
  let id = entry.replace(/\.(md|mdx)$/i, "");
  if (/^readme$/i.test(id)) {
    return localePrefix ? `${localePrefix}/docs` : "docs";
  }
  id = id.replace(/\/readme$/i, "");
  if (localePrefix) {
    return id ? `${localePrefix}/${id}` : localePrefix;
  }
  return id ? `docs/${id}` : "docs";
}

export const collections = {
  docs: defineCollection({
    loader: glob(
      {
        base: docsRoot,
        pattern: [
          "README.md",
          "guide/**/*.{md,mdx}",
          "concepts/**/*.{md,mdx}",
          "features/**/*.{md,mdx}",
          "tools/**/*.{md,mdx}",
        ],
        generateId: ({ entry }) => docsEntryId(entry),
      },
      {
        base: docsZhRoot,
        pattern: "**/*.{md,mdx}",
        generateId: ({ entry }) => docsEntryId(entry, "zh-cn"),
      },
    ),
    schema: docsSchema(),
  }),
};
