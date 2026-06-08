import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  site: "https://freeanima.com",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    starlight({
      title: "Free Anima",
      description: "数字生命不只是比喻",
      credits: false,
      components: {
        Header: "./src/components/StarlightHeader.astro",
        Footer: "./src/components/StarlightFooter.astro",
      },
      sidebar: [
        {
          label: "首页",
          link: "/",
        },
        {
          label: "文档",
          items: [
            { label: "概述", link: "/docs/" },
            { label: "身份定位", link: "/docs/identity/" },
            { label: "自我层", link: "/docs/self-layer/" },
            { label: "记忆体系", link: "/docs/memory/" },
            { label: "压缩", link: "/docs/compression/" },
            { label: "睡眠机制", link: "/docs/sleep/" },
            { label: "安全", link: "/docs/security/" },
            { label: "数据库", link: "/docs/database/" },
            { label: "发版", link: "/docs/versioning/" },
            {
              label: "设计稿",
              collapsed: true,
              items: [
                { label: "Recall Flow", link: "/docs/designs/recall-flow/" },
                { label: "时间感知", link: "/docs/designs/time-perception/" },
                { label: "结对编程 v1", link: "/docs/designs/pair-programming-v1/" },
                { label: "运行时", link: "/docs/designs/execute-code-runtimes/" },
                { label: "探针架构", link: "/docs/designs/probe-architecture/" },
                { label: "桌面伴侣", link: "/docs/designs/desktop-companion/" },
                { label: "迁移计划", link: "/docs/designs/issue-1-migration-plan/" },
              ],
            },
          ],
        },
      ],
      customCss: ["./src/styles/global.css", "./src/styles/starlight.css"],
    }),
    react(),
  ],
});
