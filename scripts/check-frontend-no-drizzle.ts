/**
 * 抽样：用 Vite 解析代表性前端入口，断言模块图不含 drizzle-orm。
 * 验收 P1（#17723）「抽样 Vite 模块图无因 UI 拉入 drizzle-orm」。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";

import {
  buildViteAliases,
  freeanimaResolvePlugin,
} from "@freeanima/client/app-frame/vite/module-aliases.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PROBE_IMPORTS = [
  "@freeanima/features/task/ui/spa/TaskApp.tsx",
  "@freeanima/features/vault/ui/spa/VaultApp.tsx",
  "@freeanima/features/diary/ui/spa/DiaryApp.tsx",
  "@freeanima/client/portal-sdk/pomodoro-active-store.ts",
  "@freeanima/shared/entity-shapes",
  "@freeanima/shared/db-shapes",
  "@freeanima/shared/pg-shapes",
];

function collectModuleIdsPlugin(ids: Set<string>): Plugin {
  return {
    name: "collect-module-ids",
    moduleParsed(moduleInfo) {
      if (moduleInfo.id) ids.add(moduleInfo.id);
    },
  };
}

async function main(): Promise<void> {
  const probeDir = mkdtempSync(join(tmpdir(), "fa-no-drizzle-"));
  const outDir = join(probeDir, "out");
  mkdirSync(outDir, { recursive: true });
  const entry = join(probeDir, "probe.ts");
  writeFileSync(
    entry,
    `${PROBE_IMPORTS.map((s, i) => `import * as m${i} from ${JSON.stringify(s)};`).join("\n")}\nexport default { ${PROBE_IMPORTS.map((_, i) => `m${i}`).join(", ")} };\n`,
  );

  const moduleIds = new Set<string>();
  try {
    await build({
      configFile: false,
      root: REPO_ROOT,
      logLevel: "error",
      plugins: [freeanimaResolvePlugin(REPO_ROOT), collectModuleIdsPlugin(moduleIds)],
      resolve: {
        alias: buildViteAliases({ repoRoot: REPO_ROOT }),
      },
      build: {
        outDir,
        emptyOutDir: true,
        write: false,
        sourcemap: false,
        minify: false,
        lib: {
          entry,
          formats: ["es"],
          fileName: "probe",
        },
        rollupOptions: {
          external: [
            /^react(\/|$)/,
            /^react-dom(\/|$)/,
            /^@react-aria\//,
            /^@react-stately\//,
            /^@tanstack\//,
            /^zod$/,
          ],
        },
      },
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env.VITE_FREEANIMA_HABITAT_WS": JSON.stringify(""),
      },
    });
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }

  const drizzleHits = [...moduleIds].filter(
    (id) => id.includes("drizzle-orm") || /[/\\]node_modules[/\\]drizzle-orm[/\\]/.test(id),
  );
  if (drizzleHits.length > 0) {
    console.error("Vite 模块图含 drizzle-orm（前端不得拖入）：");
    for (const id of drizzleHits.slice(0, 20)) {
      console.error(`  ${id}`);
    }
    process.exit(1);
  }

  console.log(
    `ok: frontend probe graph has no drizzle-orm (${moduleIds.size} modules, ${PROBE_IMPORTS.length} entries)`,
  );
}

await main();
