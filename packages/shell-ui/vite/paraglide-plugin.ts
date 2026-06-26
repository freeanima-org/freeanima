import { compileParaglideToDir } from "@freeanima/admin-frontend/paraglide-compile";
import type { Plugin } from "vite";

import { REPO_ROOT } from "./paths.ts";

/** 构建前编译 Paraglide 到 outDir/.paraglide */
export function paraglideCompilePlugin(paraglideDir: string, projectRoot = REPO_ROOT): Plugin {
  let compiled = false;

  const compile = (): void => {
    compileParaglideToDir({ projectRoot, outdir: paraglideDir });
    compiled = true;
  };

  return {
    name: "shell-ui-paraglide",
    config() {
      if (!compiled) compile();
    },
    buildStart() {
      compile();
    },
  };
}
