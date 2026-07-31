/**
 * Overlay 使用 OrthographicCamera + 极小 zoom 时，MToon screenCoordinates 描边
 * 会按透视深度公式爆炸放大，形成黑色剪影。加载后关掉屏幕描边（world 描边保留）。
 */

export type MtoonOutlineMaterialLike = {
  isMToonMaterial?: boolean;
  outlineWidthMode?: string;
};

/** 接受 three.js Object3D / Group（traverse 回调参数类型较宽） */
export function sanitizeMtoonOutlinesForOrtho(root: {
  traverse: (cb: (obj: unknown) => void) => void;
}): number {
  let sanitized = 0;
  root.traverse((obj) => {
    if (!obj || typeof obj !== "object") return;
    const materials = normalizeMaterials((obj as { material?: unknown }).material);
    for (const mat of materials) {
      if (!mat || typeof mat !== "object") continue;
      const m = mat as MtoonOutlineMaterialLike;
      if (!m.isMToonMaterial) continue;
      if (m.outlineWidthMode !== "screenCoordinates") continue;
      m.outlineWidthMode = "none";
      sanitized += 1;
    }
  });
  return sanitized;
}

function normalizeMaterials(material: unknown): unknown[] {
  if (material == null) return [];
  return Array.isArray(material) ? material : [material];
}
