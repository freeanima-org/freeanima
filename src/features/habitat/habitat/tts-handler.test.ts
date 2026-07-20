import { describe, expect, mock, test } from "bun:test";

const streamEdgeTtsAudio = mock(() => new ReadableStream());

mock.module("@freeanima/core/tts/edge-synthesize", () => ({
  streamEdgeTtsAudio,
}));

mock.module("@freeanima/platform/ports", () => ({
  assertNotShuttingDown: () => {},
}));

const { handleTtsSynthesize } = await import("./tts-handler.ts");
const { ApiHandlerError } = await import("./habitat-api/handlers/errors.ts");

describe("handleTtsSynthesize", () => {
  test("returns audio/mpeg Response on success", async () => {
    streamEdgeTtsAudio.mockImplementationOnce(() => new ReadableStream());
    const res = (await handleTtsSynthesize({} as never, { text: "你好" }, {} as never)) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(streamEdgeTtsAudio).toHaveBeenCalledWith(
      expect.objectContaining({ text: "你好", appLocale: "zh-CN" }),
    );
  });

  test("maps validation errors to ApiHandlerError 400", async () => {
    streamEdgeTtsAudio.mockImplementationOnce(() => {
      throw new Error("朗读文本不能为空");
    });
    try {
      await handleTtsSynthesize({} as never, { text: " " }, {} as never);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHandlerError);
      const apiErr = err as InstanceType<typeof ApiHandlerError>;
      expect(apiErr.status).toBe(400);
      expect(apiErr.message).toBe("朗读文本不能为空");
    }
  });

  test("maps upstream failures to ApiHandlerError 503", async () => {
    streamEdgeTtsAudio.mockImplementationOnce(() => {
      throw new Error("Edge TTS unavailable");
    });
    try {
      await handleTtsSynthesize({} as never, { text: "hello" }, {} as never);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHandlerError);
      const apiErr = err as InstanceType<typeof ApiHandlerError>;
      expect(apiErr.status).toBe(503);
      expect(apiErr.message).toBe("Edge TTS unavailable");
    }
  });
});
