declare module "*.png" {
  const src: string;
  export default src;
}

/** Bun `import … with { type: "text" }` — content string (also covers type: "file" path). */
declare module "*.md" {
  const content: string;
  export default content;
}
