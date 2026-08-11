import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/host/core/config/resolved-world-context.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

const resolveWorldFromEntityIdMock = mock(async (_id: number) => 0);
const assertSubjectCanAccessWorldMock = mock(
  async (_subjectId: number, _worldId: number, _opts?: { access?: "read" | "write" }) => {},
);

const realEntity = await import("@freeanima/host/core/db/pg/entity");
const entityOriginal = { ...realEntity };

mock.module("@freeanima/host/core/db/pg/entity", () => ({
  ...entityOriginal,
  resolveWorldFromEntityId: resolveWorldFromEntityIdMock,
  assertSubjectCanAccessWorld: assertSubjectCanAccessWorldMock,
  ToolWorldAccessError: entityOriginal.ToolWorldAccessError,
}));

afterAll(() => {
  mock.module("@freeanima/host/core/db/pg/entity", () => entityOriginal);
});

const { assertHttpCallerCanReadObjectFile, isUserAgentPrivateWorldPassthrough } =
  await import("./binary.ts");

function bindWorlds() {
  bindResolvedWorldContext({
    user_subject_id: 1,
    agent_subject_id: 2,
    user_world_id: 10,
    agent_world_id: 20,
    commons_world_id: 30,
  });
}

function ctx(partial: {
  subject_id: number;
  subject_type: "user" | "agent";
}): RemoteToolsRequestContext {
  return {
    app_id: "",
    instance_id: "",
    auth: {
      token_id: 1,
      subject_id: partial.subject_id,
      subject_type: partial.subject_type,
      scopes: [],
    },
    sendEvent() {},
  };
}

describe("isUserAgentPrivateWorldPassthrough", () => {
  beforeEach(() => {
    bindWorlds();
  });
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("allows user on agent private world", () => {
    expect(isUserAgentPrivateWorldPassthrough("user", 20)).toBe(true);
  });

  it("denies user on user private world", () => {
    expect(isUserAgentPrivateWorldPassthrough("user", 10)).toBe(false);
  });

  it("denies agent on agent private world (no reverse passthrough)", () => {
    expect(isUserAgentPrivateWorldPassthrough("agent", 20)).toBe(false);
  });
});

describe("assertHttpCallerCanReadObjectFile", () => {
  beforeEach(() => {
    bindWorlds();
    resolveWorldFromEntityIdMock.mockReset();
    assertSubjectCanAccessWorldMock.mockReset();
    assertSubjectCanAccessWorldMock.mockImplementation(async () => {});
  });
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("user reading agent-world object_file skips ACL", async () => {
    resolveWorldFromEntityIdMock.mockImplementation(async () => 20);
    await assertHttpCallerCanReadObjectFile(ctx({ subject_id: 1, subject_type: "user" }), 99);
    expect(assertSubjectCanAccessWorldMock).not.toHaveBeenCalled();
  });

  it("user reading non-agent world still uses ACL", async () => {
    resolveWorldFromEntityIdMock.mockImplementation(async () => 10);
    await assertHttpCallerCanReadObjectFile(ctx({ subject_id: 1, subject_type: "user" }), 99);
    expect(assertSubjectCanAccessWorldMock).toHaveBeenCalledWith(1, 10, { access: "read" });
  });

  it("agent token always uses ACL even for agent world", async () => {
    resolveWorldFromEntityIdMock.mockImplementation(async () => 20);
    await assertHttpCallerCanReadObjectFile(ctx({ subject_id: 2, subject_type: "agent" }), 99);
    expect(assertSubjectCanAccessWorldMock).toHaveBeenCalledWith(2, 20, { access: "read" });
  });

  it("maps ACL denial to 403", async () => {
    resolveWorldFromEntityIdMock.mockImplementation(async () => 10);
    assertSubjectCanAccessWorldMock.mockImplementation(async () => {
      throw new entityOriginal.ToolWorldAccessError("subject 1 cannot access world 10");
    });
    try {
      await assertHttpCallerCanReadObjectFile(ctx({ subject_id: 1, subject_type: "user" }), 99);
      throw new Error("expected reject");
    } catch (e) {
      const err = e as Error & { status?: number; name?: string };
      expect(err.name).toBe("ApiHandlerError");
      expect(err.status).toBe(403);
      expect(err.message).toContain("cannot access world");
    }
  });
});
