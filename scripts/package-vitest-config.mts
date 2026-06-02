/** 生成各 package 标准 vitest.config.mts（仅 unit；集成测试在仓库根 tests/integration/） */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function writeConfig(dir: string): void {
  const content = `import { defineConfig, mergeConfig } from "vitest/config";
import { vitestShared } from "../../vitest.shared.mts";

export default mergeConfig(
  vitestShared,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: ["tests/unit/**/*.test.ts"],
            passWithNoTests: true,
          },
        },
      ],
    },
  }),
);
`;
  writeFileSync(join(root, dir, "vitest.config.mts"), content, "utf-8");
}

const packages = [
  "packages/db",
  "packages/kernel",
  "packages/engine",
  "packages/memory",
  "packages/clarify",
  "packages/runtime",
  "packages/server",
  "packages/integrations",
  "packages/tools",
  "packages/gateway",
  "packages/api",
  "apps/cli",
];

for (const dir of packages) {
  writeConfig(dir);
}
