/**
 * FBX → VRMA 独立 CLI，供 `bun build --compile` 打包为 fbx2vrma.exe。
 * 依赖 fbx2vrma-converter npm 包（编译时打入二进制）。
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.path);
const FBXToVRMAConverter = require("fbx2vrma-converter") as new () => {
  run: () => Promise<void>;
};

if (import.meta.main) {
  const converter = new FBXToVRMAConverter();
  void converter.run().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
