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
    }),
    react(),
  ],
});
