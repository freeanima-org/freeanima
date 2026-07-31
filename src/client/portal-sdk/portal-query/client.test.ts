import { beforeEach, describe, expect, it } from "bun:test";

import {
  PortalQueryClient,
  hashQueryKey,
  portalCacheKey,
  resetDefaultPortalQueryClientForTest,
} from "./index.ts";

describe("portal-query keys", () => {
  it("portalCacheKey 稳定拼接", () => {
    expect(portalCacheKey("s", "task", "lists")).toBe("s|task|lists");
  });

  it("hashQueryKey 对数组稳定", () => {
    expect(hashQueryKey(["task", "lists"])).toBe(JSON.stringify(["task", "lists"]));
  });
});

describe("PortalQueryClient", () => {
  let client: PortalQueryClient;

  beforeEach(() => {
    resetDefaultPortalQueryClientForTest();
    client = new PortalQueryClient();
  });

  it("fetchQuery 写入 data 并 inflight 去重", async () => {
    let calls = 0;
    const queryFn = async () => {
      calls += 1;
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 20);
      });
      return { n: calls };
    };
    const key = ["demo", 1] as const;
    const [a, b] = await Promise.all([
      client.fetchQuery({ queryKey: key, queryFn }),
      client.fetchQuery({ queryKey: key, queryFn }),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(client.getQueryData<{ n: number }>(key)).toEqual({ n: 1 });
  });

  it("invalidateQueries 按前缀匹配并置 updatedAt=0", async () => {
    await client.fetchQuery({
      queryKey: ["task", "lists"],
      queryFn: async () => ["a"],
    });
    await client.fetchQuery({
      queryKey: ["task", "items", 1],
      queryFn: async () => ["b"],
    });
    await client.fetchQuery({
      queryKey: ["diary", "list"],
      queryFn: async () => ["c"],
    });

    let notified = 0;
    client.subscribe(["task", "lists"], () => {
      notified += 1;
    });

    await client.invalidateQueries(["task"]);
    expect(client.getQueryState(["task", "lists"]).updatedAt).toBe(0);
    expect(client.getQueryState(["task", "items", 1]).updatedAt).toBe(0);
    expect(client.getQueryState(["diary", "list"]).updatedAt).not.toBe(0);
    expect(notified).toBeGreaterThan(0);
  });

  it("setQueryData 支持 updater", async () => {
    const key = ["x"];
    client.setQueryData(key, 1);
    client.setQueryData<number>(key, (prev) => (prev ?? 0) + 1);
    expect(client.getQueryData<number>(key)).toBe(2);
  });

  it("fetch 成功后 updatedAt!==0，避免 usePortalRead 把成功当成需再拉", async () => {
    const key = ["task", "lists"] as const;
    let calls = 0;
    await client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        calls += 1;
        return ["ok"];
      },
    });
    const afterSuccess = client.getQueryState(key);
    expect(afterSuccess.status).toBe("success");
    expect(afterSuccess.updatedAt).not.toBe(0);

    // 与 usePortalRead / usePortalInfiniteQuery 的 needsFetch 条件对齐
    const keyHash = hashQueryKey(key);
    const lastFetchedHash = keyHash;
    const needsFetch =
      lastFetchedHash !== keyHash ||
      afterSuccess.updatedAt === 0 ||
      (afterSuccess.status === "idle" && afterSuccess.data === undefined);
    expect(needsFetch).toBe(false);
    expect(calls).toBe(1);

    await client.invalidateQueries(key);
    expect(client.getQueryState(key).updatedAt).toBe(0);
  });
});
