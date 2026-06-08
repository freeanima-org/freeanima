import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";

export default defineConfig({
  base: "/",
  site: "https://freeanima.com",
  integrations: [
    starlight({
      title: "Free Anima",
      description: "数字生命不只是比喻",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/freeanima-org/freeanima",
        },
      ],
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
      customCss: ["./src/styles/starlight.css"],
    }),
    react(),
  ],
});
