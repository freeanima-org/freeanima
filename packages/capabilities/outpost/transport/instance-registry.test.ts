import { describe, expect, test } from "bun:test";

import { RemoteInstanceRegistry } from "./instance-registry.ts";

describe("RemoteInstanceRegistry.resolveConnect", () => {
  test("省略 instance_id 时分配新 id", async () => {
    const registry = new RemoteInstanceRegistry();
    const result = await registry.resolveConnect({ appId: "companion" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isNew).toBe(true);
    expect(result.instanceId).toMatch(/^[a-z0-9]{3}$/);
  });

  test("携带合法且未使用的 instance_id 时自动 provision", async () => {
    const registry = new RemoteInstanceRegistry();
    const result = await registry.resolveConnect({
      appId: "chat",
      instanceId: "def",
      httpUrl: "http://127.0.0.1:4174",
    });
    expect(result).toEqual({ ok: true, instanceId: "def", isNew: true });
    const row = registry.get("def");
    expect(row?.appId).toBe("chat");
    expect(row?.httpUrl).toBe("http://127.0.0.1:4174");
  });

  test("已存在 instance_id 重连时更新 http_url", async () => {
    const registry = new RemoteInstanceRegistry();
    await registry.resolveConnect({ appId: "chat", instanceId: "def" });
    const again = await registry.resolveConnect({
      appId: "chat",
      instanceId: "def",
      httpUrl: "http://192.168.1.2:4174",
    });
    expect(again).toEqual({ ok: true, instanceId: "def", isNew: false });
    expect(registry.get("def")?.httpUrl).toBe("http://192.168.1.2:4174");
  });

  test("instance_id 已绑定其它 app 时拒绝", async () => {
    const registry = new RemoteInstanceRegistry();
    await registry.resolveConnect({ appId: "companion", instanceId: "abc" });
    const result = await registry.resolveConnect({ appId: "chat", instanceId: "abc" });
    expect(result).toEqual({ ok: false, error: "instance_id app mismatch: abc" });
  });

  test("非法 instance_id 格式时拒绝", async () => {
    const registry = new RemoteInstanceRegistry();
    const result = await registry.resolveConnect({ appId: "chat", instanceId: "too-long" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("invalid outpost instance_id");
  });
});
