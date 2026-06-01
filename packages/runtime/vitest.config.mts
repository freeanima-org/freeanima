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
          },
        },
    {
      extends: true,
      test: {
            name: "integration",
            include: ["tests/integration/**/*.test.ts"],
            testTimeout: 30_000,
            passWithNoTests: true,
          },
        }
      ],
    },
  }),
);
