import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import mermaid from "astro-mermaid";
import { fileURLToPath } from "node:url";

import { starlightSidebar } from "./src/lib/sidebar.ts";
import { docRedirects } from "./src/lib/doc-redirects.ts";
import { rehypeDocsMdLinks } from "./src/plugins/rehype-docs-md-links.ts";
import { faMermaidConfig } from "./src/lib/mermaid-theme.ts";

const docsRoot = fileURLToPath(new URL("./src/content/docs", import.meta.url));

/** 旧 /zh-cn/* 路径去掉前缀，非 i18n 系统 */
const zhCnStripRedirects = {
  "/zh-cn": "/",
  "/zh-cn/": "/",
};

export default defineConfig({
  base: "/",
  site: "https://freeanima.com",
  cacheDir: fileURLToPath(new URL("./.astro", import.meta.url)),
  redirects: {
    ...docRedirects,
    ...zhCnStripRedirects,
  },
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeDocsMdLinks, { docsRoot }]],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    mermaid(faMermaidConfig),
    starlight({
      title: "逸灵风",
      description: "数字人类的栖息地——不是比喻",
      credits: false,
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
