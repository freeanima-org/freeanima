import { ensureFbx2gltf } from "../server/fbx2gltf-install.ts";
import { findFbx2gltfBinary } from "../server/fbx-converter-kit.ts";

const strict = process.argv.includes("--strict");

setTimeout(() => {
  console.error("[companion] FBX2glTF 安装超时（3 分钟）");
  process.exit(1);
}, 180_000).unref();

if (findFbx2gltfBinary()) {
  console.log("[companion] FBX2glTF 已就绪");
  process.exit(0);
}

const ok = await ensureFbx2gltf({ strict });
process.exit(ok || !strict ? 0 : 1);
