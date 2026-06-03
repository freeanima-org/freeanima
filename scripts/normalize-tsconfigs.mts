#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const PKG = {
  "packages/api/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/clarify/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/db/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/engine/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/gateway/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/integrations/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/kernel/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/memory/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/runtime/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/server/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "packages/tools/tsconfig.json": { extend: "../../tsconfig.base.json", bun: false },
  "apps/cli/tsconfig.json": { extend: "../../tsconfig.base.json", bun: true },
  "kernel/hooks/tsconfig.json": { extend: "../../tsconfig.base.json", bun: true },
  "kernel/kernel/tsconfig.json": { extend: "../../tsconfig.base.json", bun: true },
};

for (const [rel, { extend, bun }] of Object.entries(PKG)) {
  const opts = bun ? ',\n  "compilerOptions": {\n    "types": ["bun-types"]\n  }' : "";
  const json = `{
  "extends": "${extend}"${opts},
  "include": ["src/**/*.ts"]
}
`;
  writeFileSync(join(ROOT, rel), json);
}

writeFileSync(
  join(ROOT, "tests/tsconfig.json"),
  `{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"],
    "rootDir": "."
  },
  "include": ["helpers/**/*.ts", "integration/**/*.ts"]
}
`,
);

console.log("ok");
