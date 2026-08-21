import { describe, expect, test } from "bun:test";

import {
  assertDataCapability,
  DataCapabilityError,
  filterWorldIdsByDataCapability,
  openDataCapability,
} from "./data-capability.ts";
import {
  expandTokenPreset,
  isFullTokenAuthorization,
  moduleFromRpcMethod,
  parseServiceApiTokenAuthorization,
  tokenAllowsModule,
} from "./token-authorization.ts";

describe("assertDataCapability", () => {
  test("open data allows any component/world/write", () => {
    expect(() =>
      assertDataCapability(openDataCapability(), {
        component: "vault_item",
        worldId: 9,
        access: "write",
      }),
    ).not.toThrow();
  });

  test("denies missing component", () => {
    expect(() =>
      assertDataCapability(
        {
          allowed_components: ["task_item"],
          denied_components: [],
          allowed_worlds: ["*"],
          denied_worlds: [],
          access: "read",
        },
        { component: "vault_item" },
      ),
    ).toThrow(DataCapabilityError);
  });

  test("write required but only read", () => {
    expect(() =>
      assertDataCapability(
        {
          allowed_components: ["*"],
          denied_components: [],
          allowed_worlds: ["*"],
          denied_worlds: [],
          access: "read",
        },
        { access: "write" },
      ),
    ).toThrow(/access/);
  });

  test("filterWorldIdsByDataCapability intersects", () => {
    expect(
      filterWorldIdsByDataCapability([1, 2, 3], {
        allowed_components: ["*"],
        denied_components: [],
        allowed_worlds: [2, 3],
        denied_worlds: [3],
        access: "read",
      }),
    ).toEqual([2]);
  });
});

describe("token authorization", () => {
  test("full parse and module", () => {
    const authz = parseServiceApiTokenAuthorization({ full: true });
    expect(isFullTokenAuthorization(authz)).toBe(true);
    expect(tokenAllowsModule(authz, "tokens")).toBe(true);
  });

  test("mcp preset", () => {
    const authz = expandTokenPreset("mcp", { worldIds: [42] });
    expect(authz.full).toBe(false);
    if (authz.full) throw new Error("unreachable");
    expect(authz.portal).toBe("mcp");
    expect(tokenAllowsModule(authz, "chat")).toBe(true);
    expect(authz.data.allowed_worlds).toEqual([42]);
  });

  test("extension preset modules whitelist", () => {
    const authz = expandTokenPreset("extension");
    expect(authz.full).toBe(false);
    if (authz.full) throw new Error("unreachable");
    expect(tokenAllowsModule(authz, "chat")).toBe(true);
    expect(tokenAllowsModule(authz, "tokens")).toBe(false);
  });

  test("moduleFromRpcMethod", () => {
    expect(moduleFromRpcMethod("chat.send")).toBe("chat");
    expect(moduleFromRpcMethod("tokens.createForSubject")).toBe("tokens");
  });
});
