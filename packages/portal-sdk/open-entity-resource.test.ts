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

describe("subscribeEntityOverlayClose", () => {
  it("notifies listeners and supports unsubscribe", async () => {
    const { notifyEntityOverlayClosed, subscribeEntityOverlayClose } =
      await import("./open-entity-resource.ts");
    const seen: Array<{ id: number; component: string }> = [];
    const stop = subscribeEntityOverlayClose((info) => {
      seen.push(info);
    });
    notifyEntityOverlayClosed({ id: 559, component: "task_item" });
    expect(seen).toEqual([{ id: 559, component: "task_item" }]);
    stop();
    notifyEntityOverlayClosed({ id: 560, component: "task_item" });
    expect(seen).toEqual([{ id: 559, component: "task_item" }]);
  });
});
