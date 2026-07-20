import { beforeAll, describe, expect, test } from "bun:test";

import { getHubMethodDef } from "@freeanima/shared/habitat-contract";
import { initHubRouter, resetHubRouterForTests } from "@freeanima/platform/habitat/init.ts";
import { resetHubMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import { buildHabitatRestRequest, isNonJsonHabitatHttpMethod } from "@freeanima/shared/habitat-rpc";

describe("http-rest feature methods", () => {
  beforeAll(() => {
    resetHubMethodRegistryForTests();
    resetHubRouterForTests();
    initHubRouter();
  });

  test("buildHabitatRestRequest GET tasklist.item.list", () => {
    const { url, init } = buildHabitatRestRequest(
      "http://127.0.0.1:2658",
      "tasklist.item.list",
      { subject_kind: "user", list_id: 1 },
      "fa_at_test",
    );
    expect(url).toBe("http://127.0.0.1:2658/rpc/v1/tasklist/item/list?subject_kind=user&list_id=1");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fa_at_test");
  });

  test("buildHabitatRestRequest POST tasklist.item.create", () => {
    const { url, init } = buildHabitatRestRequest("http://127.0.0.1:2658", "tasklist.item.create", {
      subject_kind: "user",
      title: "x",
      list_id: 1,
    });
    expect(url).toBe("http://127.0.0.1:2658/rpc/v1/tasklist/item/create");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ subject_kind: "user", title: "x", list_id: 1 }));
  });

  test("buildHabitatRestRequest GET diary.get path id", () => {
    const http = getHubMethodDef("diary.get").meta.http!;
    expect(http.pathParams ?? []).toEqual(["id"]);
    const { url } = buildHabitatRestRequest("http://127.0.0.1:2658", "diary.get", {
      subject_kind: "agent",
      id: 1,
    });
    expect(url).toBe("http://127.0.0.1:2658/rpc/v1/diary/get/1?subject_kind=agent");
  });

  test("buildHabitatRestRequest POST vault.get path id", () => {
    const http = getHubMethodDef("vault.get").meta.http!;
    expect(http.verb).toBe("POST");
    const { url, init } = buildHabitatRestRequest("http://127.0.0.1:2658", "vault.get", {
      id: 3,
      subject_kind: "user",
    });
    expect(url).toBe("http://127.0.0.1:2658/rpc/v1/vault/get/3");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ subject_kind: "user" }));
  });

  test("buildHabitatRestRequest GET tasklist.item.list with filters object", () => {
    const { url } = buildHabitatRestRequest("http://127.0.0.1:2658", "tasklist.item.list", {
      subject_kind: "user",
      filters: { status: "pending", in_backlog: true },
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/rpc/v1/tasklist/item/list");
    expect(parsed.searchParams.get("subject_kind")).toBe("user");
    expect(JSON.parse(parsed.searchParams.get("filters") ?? "")).toEqual({
      status: "pending",
      in_backlog: true,
    });
  });

  test("conversation.messages path param", () => {
    const { url } = buildHabitatRestRequest("http://127.0.0.1:2658", "conversation.messages", {
      conversation_id: "abc",
      limit: 50,
    });
    expect(url).toBe("http://127.0.0.1:2658/rpc/v1/conversation/messages/abc?limit=50");
  });

  test("buildHabitatRestRequest multipart companion.model.upload", () => {
    const form = new FormData();
    form.append("file", new Blob(["x"]), "test.vrm");
    const { url, init } = buildHabitatRestRequest(
      "http://127.0.0.1:2658",
      "companion.model.upload",
      {},
      "fa_at_test",
      { body: form },
    );
    expect(url).toBe("http://127.0.0.1:2658/rpc/v1/companion/model/upload");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fa_at_test");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(form);
  });

  test("isNonJsonHabitatHttpMethod feature methods", () => {
    expect(isNonJsonHabitatHttpMethod("tasklist.item.list")).toBe(false);
    expect(isNonJsonHabitatHttpMethod("companion.model.upload")).toBe(true);
  });
});
