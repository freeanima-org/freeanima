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
          autogenerate: { directory: "docs" },
        },
      ],
      customCss: ["./src/styles/global.css", "./src/styles/starlight.css"],
    }),
    react(),
  ],
});
