import { describe, it, expect } from "bun:test";
import { resolveProductionWebuiAssetPath } from "./webui-server.ts";

describe("resolveProductionWebuiAssetPath", () => {
  it("chunk 资源保留文件名", () => {
    expect(resolveProductionWebuiAssetPath("/webui/chunk-abc123.js")).toBe("chunk-abc123.js");
    expect(resolveProductionWebuiAssetPath("/webui/chunk-abc123.css")).toBe("chunk-abc123.css");
  });

  it("SPA 路由回退 index.html", () => {
    expect(resolveProductionWebuiAssetPath("/webui/")).toBe("index.html");
    expect(resolveProductionWebuiAssetPath("/webui")).toBe("index.html");
    expect(resolveProductionWebuiAssetPath("/webui/chat/sessions")).toBe("index.html");
  });
});
