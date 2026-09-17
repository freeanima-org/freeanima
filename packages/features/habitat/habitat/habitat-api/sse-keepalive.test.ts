import { describe, expect, it } from "bun:test";
import { withSseKeepalive } from "./sse-keepalive.ts";

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}

describe("withSseKeepalive", () => {
  it("yields keepalive when source is idle longer than interval", async () => {
    const intervalMs = 30;
    async function* slow(): AsyncGenerator<{ n: number }> {
      await Bun.sleep(intervalMs + 20);
      yield { n: 1 };
    }

    const items = await collect(
      withSseKeepalive(slow(), () => ({ n: -1 }), undefined, { intervalMs }),
    );
    expect(items.some((i) => i.n === -1)).toBe(true);
    expect(items.some((i) => i.n === 1)).toBe(true);
  });

  it("does not inject keepalive when source yields promptly", async () => {
    async function* fast(): AsyncGenerator<{ n: number }> {
      yield { n: 1 };
      yield { n: 2 };
    }

    const items = await collect(withSseKeepalive(fast(), () => ({ n: -1 })));
    expect(items).toEqual([{ n: 1 }, { n: 2 }]);
  });
});
