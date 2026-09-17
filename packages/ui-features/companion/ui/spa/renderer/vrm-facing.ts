/** VRM 0.x 面向 +Z，需绕 Y 轴转 180° 才朝向相机（-Z）；VRM 1.0 默认已朝 -Z。 */
export function resolveFacingOffsetY(metaVersion: string | undefined): number {
  return metaVersion === "0" ? Math.PI : 0;
}
