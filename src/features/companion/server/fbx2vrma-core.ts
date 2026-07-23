/**
 * FBX → VRMA 进程内转换（sidecar 直接 import，不 spawn 子进程）。
 */
// @ts-expect-error fbx2vrma-converter 为 CJS 包
import FBXToVRMAConverter from "fbx2vrma-converter/fbx2vrma-converter.js";

type ConverterInstance = InstanceType<typeof FBXToVRMAConverter>;

function createConverter(): ConverterInstance {
  return new FBXToVRMAConverter();
}

/** 进程内转换（sidecar 导入路径） */
export async function convertFbxToVrmaFiles(
  inputPath: string,
  outputPath: string,
  fbx2gltfPath: string,
  framerate = "30",
): Promise<void> {
  const oldArgv = process.argv;
  process.argv = [
    oldArgv[0] ?? "bun",
    "fbx2vrma",
    "-i",
    inputPath,
    "-o",
    outputPath,
    "--fbx2gltf",
    fbx2gltfPath,
    "--framerate",
    framerate,
  ];
  try {
    const converter = createConverter();
    const ok = await converter.convert(inputPath, outputPath, fbx2gltfPath, framerate);
    if (!ok) {
      throw new Error("FBX 转 VRMA 失败，请确认 Mixamo 导出为 Without Skin、In Place");
    }
  } finally {
    process.argv = oldArgv;
  }
}
