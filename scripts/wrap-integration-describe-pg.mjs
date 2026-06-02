import fs from "node:fs";
import path from "node:path";

const gateImport = (fromDir) => {
  const rel = path.relative(fromDir, "tests/helpers/pg-test-gate.ts");
  return `import { describePg } from "${rel.startsWith(".") ? rel : "./" + rel}";\n`;
};

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".test.ts")) {
      let s = fs.readFileSync(p, "utf-8");
      if (s.includes("describePg")) continue;
      if (!s.includes('from "vitest"')) continue;
      const gate = gateImport(path.dirname(p));
      s = s.replace(/import \{([^}]+)\} from "vitest";/, `import {$1} from "vitest";\n${gate}`);
      s = s.replace(/^describe\(/m, "describePg(");
      fs.writeFileSync(p, s);
      console.log("updated", p);
    }
  }
}

for (const pkg of [
  "packages/engine",
  "packages/runtime",
  "packages/memory",
  "packages/clarify",
  "packages/server",
  "packages/integrations",
]) {
  const d = `tests/integration/${pkg.replace("packages/", "")}`;
  if (fs.existsSync(d)) walk(d);
}
