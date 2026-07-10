import { describe, expect, test } from "bun:test";

import { getHubMethodDef } from "@freeanima/shared/hub-contract";

import {
  appendPayloadToQuery,
  buildHubRestRequest,
  hubRpcRestPrefix,
  hubRestUrl,
  isNonJsonHubHttpMethod,
  parseQueryToPayload,
} from "./http-rest.ts";

describe("http-rest", () => {
  test("hubRpcRestPrefix", () => {
    expect(hubRpcRestPrefix()).toBe("/hub/rpc/v1");
  });

  test("buildHubRestRequest GET task.list", () => {
    const { url, init } = buildHubRestRequest(
      "http://127.0.0.1:2658",
      "task.list",
      { subject_kind: "user", list_id: 1 },
      "fa_at_test",
    );
    expect(url).toBe("http://127.0.0.1:2658/hub/rpc/v1/task/list?subject_kind=user&list_id=1");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fa_at_test");
  });

  test("buildHubRestRequest POST task.create", () => {
    const { url, init } = buildHubRestRequest("http://127.0.0.1:2658", "task.create", {
      subject_kind: "user",
      title: "x",
      list_id: 1,
    });
    expect(url).toBe("http://127.0.0.1:2658/hub/rpc/v1/task/create");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ subject_kind: "user", title: "x", list_id: 1 }));
  });

  test("buildHubRestRequest GET dream.get uses query not path id", () => {
    const http = getHubMethodDef("dream.get").meta.http!;
    expect(http.pathParams ?? []).toEqual([]);
    const { url } = buildHubRestRequest("http://127.0.0.1:2658", "dream.get", {
      day: "2026-07-10",
    });
    expect(url).toBe("http://127.0.0.1:2658/hub/rpc/v1/dream/get?day=2026-07-10");
  });

  test("buildHubRestRequest POST vault.get path id", () => {
    const http = getHubMethodDef("vault.get").meta.http!;
    expect(http.verb).toBe("POST");
    const { url, init } = buildHubRestRequest("http://127.0.0.1:2658", "vault.get", {
      id: 3,
      subject_kind: "user",
    });
    expect(url).toBe("http://127.0.0.1:2658/hub/rpc/v1/vault/get/3");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ subject_kind: "user" }));
  });

  test("appendPayloadToQuery and parseQueryToPayload roundtrip", () => {
    const params = new URLSearchParams();
    appendPayloadToQuery(
      params,
      { subject_kind: "user", tags: ["a", "b"], active: true, note: null },
      new Set(),
    );
    expect(params.toString()).toBe("subject_kind=user&tags=a&tags=b&active=true&note=");
    const parsed = parseQueryToPayload(params, new Set());
    expect(parsed).toEqual({
      subject_kind: "user",
      tags: ["a", "b"],
      active: true,
      note: "",
    });
  });

  test("buildHubRestRequest GET task.list with filters object", () => {
    const { url } = buildHubRestRequest("http://127.0.0.1:2658", "task.list", {
      subject_kind: "user",
      filters: { status: "pending", in_backlog: true },
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/hub/rpc/v1/task/list");
    expect(parsed.searchParams.get("subject_kind")).toBe("user");
    expect(JSON.parse(parsed.searchParams.get("filters") ?? "")).toEqual({
      status: "pending",
      in_backlog: true,
    });
    const roundtrip = parseQueryToPayload(parsed.searchParams, new Set());
    expect(roundtrip).toEqual({
      subject_kind: "user",
      filters: { status: "pending", in_backlog: true },
    });
  });

  test("conversation.messages path param", () => {
    const { url } = buildHubRestRequest("http://127.0.0.1:2658", "conversation.messages", {
      conversation_id: "abc",
      limit: 50,
    });
    expect(url).toBe("http://127.0.0.1:2658/hub/rpc/v1/conversation/messages/abc?limit=50");
  });

  test("hubRestUrl for tls.ca", () => {
    expect(hubRestUrl("http://127.0.0.1:2658", "tls.ca", {})).toBe(
      "http://127.0.0.1:2658/hub/rpc/v1/tls/ca",
    );
  });

  test("tls.ca.qr marked raw response", () => {
    const http = getHubMethodDef("tls.ca.qr").meta.http!;
    expect(http.response).toBe("raw");
  });

  test("buildHubRestRequest multipart companion.model.upload", () => {
    const form = new FormData();
    form.append("file", new Blob(["x"]), "test.vrm");
    const { url, init } = buildHubRestRequest(
      "http://127.0.0.1:2658",
      "companion.model.upload",
      {},
      "fa_at_test",
      { body: form },
    );
    expect(url).toBe("http://127.0.0.1:2658/hub/rpc/v1/companion/model/upload");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fa_at_test");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(form);
  });

  test("isNonJsonHubHttpMethod", () => {
    expect(isNonJsonHubHttpMethod("task.list")).toBe(false);
    expect(isNonJsonHubHttpMethod("tls.ca")).toBe(true);
    expect(isNonJsonHubHttpMethod("companion.model.upload")).toBe(true);
  });
});
