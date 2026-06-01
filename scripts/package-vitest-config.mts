/** 生成各 package 标准 vitest.config.mts（unit + 可选 integration project） */
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function writeConfig(dir: string, hasIntegration: boolean): void {
  const integrationProject = hasIntegration
    ? `,
    {
      extends: true,
      test: {
            name: "integration",
            include: ["tests/integration/**/*.test.ts"],
            testTimeout: 30_000,
            passWithNoTests: true,
          },
        }`
    : "";

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
        }${integrationProject}
      ],
    },
  }),
);
`;
  writeFileSync(join(root, dir, "vitest.config.mts"), content, "utf-8");
}

const packages: Array<{ dir: string; integration: boolean }> = [
  { dir: "packages/db", integration: true },
  { dir: "packages/kernel", integration: false },
  { dir: "packages/engine", integration: true },
  { dir: "packages/memory", integration: true },
  { dir: "packages/clarify", integration: true },
  { dir: "packages/runtime", integration: true },
  { dir: "packages/server", integration: true },
  { dir: "packages/integrations", integration: true },
  { dir: "packages/tools", integration: false },
  { dir: "packages/api", integration: false },
  { dir: "apps/cli", integration: false },
];

for (const { dir, integration } of packages) {
  writeConfig(dir, integration);
}
