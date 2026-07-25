import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { fileURLToPath } from "node:url";

const docsRoot = fileURLToPath(new URL("./content/docs", import.meta.url));
const generatedZhSegment = ".generated/zh_CN/";

function docsEntryId(entry: string): string {
  const isZh = entry.startsWith(generatedZhSegment);
  const localePrefix = isZh ? "zh-cn" : undefined;
  let id = entry.replace(/\.(md|mdx)$/i, "");
  if (isZh) {
    id = id.slice(generatedZhSegment.length);
  }
  if (/^readme$/i.test(id)) {
    return localePrefix ? `${localePrefix}/docs` : "docs";
  }
  id = id.replace(/\/readme$/i, "");
  if (localePrefix) {
    // Must mirror root IDs (`docs/...`) so Starlight localizedSlug() matches translations.
    return id ? `${localePrefix}/docs/${id}` : `${localePrefix}/docs`;
  }
  return id ? `docs/${id}` : "docs";
}

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: docsRoot,
      pattern: [
        "README.md",
        "product/**/*.{md,mdx}",
        "cognition/**/*.{md,mdx}",
        "aspects/**/*.{md,mdx}",
        "modules/**/*.{md,mdx}",
        "ops/**/*.{md,mdx}",
        "tools/**/*.{md,mdx}",
        "ui/**/*.{md,mdx}",
        // legacy prefixes (redirects / frozen trees)
        "guide/**/*.{md,mdx}",
        "concepts/**/*.{md,mdx}",
        "features/**/*.{md,mdx}",
        "sap/**/*.{md,mdx}",
        ".generated/zh_CN/**/*.{md,mdx}",
      ],
      generateId: ({ entry }) => docsEntryId(entry),
    }),
    schema: docsSchema(),
  }),
};
