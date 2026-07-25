import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import mermaid from "astro-mermaid";
import { fileURLToPath } from "node:url";

import { starlightSidebar } from "./src/lib/sidebar.ts";
import { docRedirects } from "./src/lib/doc-redirects.ts";
import { rehypeDocsMdLinks } from "./src/plugins/rehype-docs-md-links.ts";
import { faMermaidConfig } from "./src/lib/mermaid-theme.ts";

const docsRoot = fileURLToPath(new URL("./src/content/docs", import.meta.url));
const docsZhRoot = fileURLToPath(new URL("../docs/.generated/zh_CN", import.meta.url));

export default defineConfig({
  base: "/",
  site: "https://freeanima.com",
  cacheDir: fileURLToPath(new URL("./.astro", import.meta.url)),
  redirects: docRedirects,
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeDocsMdLinks, { enRoot: docsRoot, zhRoot: docsZhRoot }]],
    }),
  },
  vite: {
    plugins: [
      tailwindcss(),
      paraglideVitePlugin({
        project: "../project.inlang",
        outdir: "../messages/paraglide",
      }),
      paraglideVitePlugin({
        project: "../project.site.inlang",
        outdir: "../messages/paraglide-site",
      }),
    ],
    resolve: {
      alias: {
        "@paraglide/messages": fileURLToPath(
          new URL("../messages/paraglide/messages.js", import.meta.url),
        ),
        "@paraglide/runtime": fileURLToPath(
          new URL("../messages/paraglide/runtime.js", import.meta.url),
        ),
        "@paraglide-site/messages": fileURLToPath(
          new URL("../messages/paraglide-site/messages.js", import.meta.url),
        ),
        "@paraglide-site/runtime": fileURLToPath(
          new URL("../messages/paraglide-site/runtime.js", import.meta.url),
        ),
      },
    },
  },
  integrations: [
    mermaid(faMermaidConfig),
    starlight({
      title: "Free Anima",
      description: "A runtime for digital humans — not a metaphor",
      credits: false,
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
        },
        "zh-cn": {
          label: "简体中文",
          lang: "zh-CN",
        },
      },
      components: {
        Header: "./src/components/StarlightHeader.astro",
        Footer: "./src/components/StarlightFooter.astro",
      },
      sidebar: starlightSidebar,
      customCss: ["./src/styles/global.css", "./src/styles/starlight-custom.css"],
      expressiveCode: {
        themes: ["starlight-dark", "starlight-light"],
        useStarlightDarkModeSwitch: true,
        styleOverrides: { borderRadius: "0px" },
      },
      markdown: {
        processedDirs: ["../docs/.generated/zh_CN"],
      },
    }),
    react(),
  ],
});
