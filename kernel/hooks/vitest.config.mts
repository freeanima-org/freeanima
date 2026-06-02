import { defineConfig, mergeConfig } from "vitest/config";
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
            coverage: {
              provider: "v8",
              include: ["src/**/*.ts"],
              thresholds: {
                lines: 100,
                functions: 100,
                statements: 100,
                branches: 100,
              },
            },
          },
        },
      ],
    },
  }),
);
