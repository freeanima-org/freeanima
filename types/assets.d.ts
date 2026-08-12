declare module "*.png" {
  const src: string;
  export default src;
}

/** Bun `import … with { type: "text" }` — content string (also covers type: "file" path). */
declare module "*.md" {
  const content: string;
  export default content;
}

/** Bun `dir:` namespace 插件：目录 → 相对路径 → `type: "file"` 路径 map。 */
declare module "dir:*" {
  const assets: Record<string, string>;
  export default assets;
}
