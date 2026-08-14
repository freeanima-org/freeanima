/** @deprecated 本地 locomotion 导入已停用 */
export async function importLocomotionFromUpload(): Promise<never> {
  throw new Error("请经 Habitat companion.motion.import");
}
