import { describe, expect, mock, test } from "bun:test";

import { sendTabMessageAllFrames } from "./tab-frames.ts";

describe("sendTabMessageAllFrames", () => {
  test("枚举到多个 frame 时按 frameId 广播", async () => {
    const sendMessage = mock(() => Promise.resolve());
    const getAllFrames = mock(() =>
      Promise.resolve([{ frameId: 0 }, { frameId: 12 }, { frameId: 34 }]),
    );

    await sendTabMessageAllFrames(
      7,
      { type: "fill_login" },
      {
        webNavigation: { getAllFrames },
        tabs: { sendMessage },
      },
    );

    expect(getAllFrames).toHaveBeenCalledWith({ tabId: 7 });
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sendMessage.mock.calls[0]).toEqual([7, { type: "fill_login" }, { frameId: 0 }]);
    expect(sendMessage.mock.calls[1]).toEqual([7, { type: "fill_login" }, { frameId: 12 }]);
    expect(sendMessage.mock.calls[2]).toEqual([7, { type: "fill_login" }, { frameId: 34 }]);
  });

  test("无 frames 时回退顶层一次发送", async () => {
    const sendMessage = mock(() => Promise.resolve());
    await sendTabMessageAllFrames(
      3,
      { type: "fill_field", value: "x" },
      {
        webNavigation: { getAllFrames: async () => null },
        tabs: { sendMessage },
      },
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]).toEqual([3, { type: "fill_field", value: "x" }]);
  });

  test("单个 frame 发送失败不影响其余", async () => {
    const sendMessage = mock((tabId: number, _msg: unknown, options?: { frameId?: number }) => {
      if (options?.frameId === 1) return Promise.reject(new Error("no receiver"));
      return Promise.resolve(tabId);
    });

    await sendTabMessageAllFrames(
      9,
      { type: "fill_card" },
      {
        webNavigation: {
          getAllFrames: async () => [{ frameId: 0 }, { frameId: 1 }, { frameId: 2 }],
        },
        tabs: { sendMessage },
      },
    );

    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  test("getAllFrames 抛错时回退顶层", async () => {
    const sendMessage = mock(() => Promise.resolve());
    await sendTabMessageAllFrames(
      1,
      { type: "fill_identity" },
      {
        webNavigation: {
          getAllFrames: async () => {
            throw new Error("no permission");
          },
        },
        tabs: { sendMessage },
      },
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]).toEqual([1, { type: "fill_identity" }]);
  });
});
