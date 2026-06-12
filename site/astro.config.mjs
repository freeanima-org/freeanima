import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import mermaid from "astro-mermaid";
import { fileURLToPath } from "node:url";

import { starlightSidebar } from "./src/lib/sidebar.ts";
import { docRedirects } from "./src/lib/doc-redirects.ts";
import { rehypeDocsMdLinks } from "./src/plugins/rehype-docs-md-links.ts";

const docsRoot = fileURLToPath(new URL("../docs", import.meta.url));
const docsZhRoot = fileURLToPath(new URL("../docs/.generated/zh_CN", import.meta.url));

export default defineConfig({
  base: "/",
  site: "https://freeanima.com",
  redirects: docRedirects,
  markdown: {
    rehypePlugins: [[rehypeDocsMdLinks, { enRoot: docsRoot, zhRoot: docsZhRoot }]],
  },
  vite: {
    plugins: [
      tailwindcss(),
      paraglideVitePlugin({
        project: "../project.inlang",
        outdir: "../messages/paraglide",
      }),
    ],
  },
  integrations: [
    mermaid({
      autoTheme: true,
      enableLog: false,
    }),
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
    }),
    react(),
  ],
});
