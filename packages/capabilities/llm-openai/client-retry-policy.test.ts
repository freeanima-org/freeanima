import { describe, expect, it } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { createOpenAiClientFromParsed } from "./client.ts";

/**
 * 重试策略回归护栏。
 *
 * 推理路径（chat / embeddings / …）依赖 SDK 的自动重试吸收瞬时 429 / 5xx；
 * `/models` 目录查询是可选增强，必须快速失败（由 AbortSignal 预算表达），
 * 不能把自己的连接重试成本转嫁给调用方（newConversation / computeStats）。
 *
 * 这条界线曾经被破坏过：把 `maxRetries: 0` 写进共享工厂会让推理请求也变成
 * 单次尝试，而 `sdk-retry-guard.test.ts` 只测 fetch 层、不会发现。
 */

/** 前 `failures` 次请求返回 503，之后返回 200 JSON */
async function withFlakyServer<T>(
  failures: number,
  run: (baseUrl: string, hits: () => number) => Promise<T>,
): Promise<T> {
  let hits = 0;
  const server = createServer((_req, res) => {
    hits += 1;
    if (hits <= failures) {
      res.writeHead(503);
      res.end("transient");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [] }));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${String(port)}/v1`, () => hits);
  } finally {
    server.close();
  }
}

async function attemptsFor(
  baseUrl: string,
  hits: () => number,
  client: ReturnType<typeof createOpenAiClientFromParsed>,
): Promise<number> {
  try {
    await client.models.list({ signal: AbortSignal.timeout(8_000) });
  } catch {
    /* 预算内失败同样计入尝试次数 */
  }
  void baseUrl;
  return hits();
}

describe("OpenAI client retry policy", () => {
  it("keeps SDK retries for inference clients so transient 5xx is absorbed", async () => {
    const attempts = await withFlakyServer(2, (baseUrl, hits) =>
      attemptsFor(baseUrl, hits, createOpenAiClientFromParsed({ baseUrl, apiKey: "k" })),
    );
    // SDK 默认重试 2 次：两次 503 之后第三次成功
    expect(attempts).toBe(3);
  });

  it("fails fast for the catalog client so /models cannot stall callers", async () => {
    const attempts = await withFlakyServer(2, (baseUrl, hits) =>
      attemptsFor(
        baseUrl,
        hits,
        createOpenAiClientFromParsed({ baseUrl, apiKey: "k" }, { retries: 0 }),
      ),
    );
    expect(attempts).toBe(1);
  });
});
