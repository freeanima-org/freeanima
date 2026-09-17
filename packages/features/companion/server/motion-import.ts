/** @deprecated 本地 motion import 已停用；请走 Habitat companion.motion.import */
export { sanitizeMotionBaseName } from "../domain/motion-import.ts";

export async function importMotionUpload(_filename: string, _bytes: Uint8Array): Promise<never> {
  throw new Error("请经 Habitat companion.motion.import");
}
