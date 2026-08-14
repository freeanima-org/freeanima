import { afterEach, describe, expect, it } from "bun:test";

import {
  openEntityResource,
  setAnimaUriPrimaryComponentResolver,
  setEntityOverlayOpener,
  type EntityOverlayOpenRequest,
} from "./open-entity-resource.ts";

describe("openEntityResource", () => {
  afterEach(() => {
    setEntityOverlayOpener(null);
    setAnimaUriPrimaryComponentResolver(null);
  });

  it("opens generic overlay when primary_component unresolved", async () => {
    const opened: EntityOverlayOpenRequest[] = [];
    setEntityOverlayOpener((req) => {
      opened.push(req);
    });
    setAnimaUriPrimaryComponentResolver(async () => null);

    const result = await openEntityResource("anima:1941");
    expect(result).toEqual({ ok: true, mode: "overlay" });
    expect(opened).toEqual([{ id: 1941, component: "", present: "overlay" }]);
  });

  it("returns Chinese error when host not mounted", async () => {
    setAnimaUriPrimaryComponentResolver(async () => "task_item");
    const result = await openEntityResource("anima:1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("浮层未就绪");
  });

  it("returns Chinese parse error", async () => {
    const result = await openEntityResource("anima://1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("不支持");
  });
});
