import { getToolSessionId } from "@freeanima/engine-loop";
import { registerTool, toolResult, toolError, type ToolArgs } from "@freeanima/engine-tool";
import { writeFridgeMagnet } from "./store.ts";

export function registerWriteFridgeMagnetTool(): void {
  registerTool({
    name: "write_fridge_magnet",
    description:
      "在冰箱贴上写一张便签。冰箱贴是跨轮对话的临时状态共享黑板，贴在当前 session 中，有过期时间。key 是标签名（如 sky_mood），value 是内容。",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "便签名称，如 sky_mood" },
        value: { type: "string", description: "便签内容" },
        ttl_seconds: {
          type: "number",
          description: "过期时间（秒），默认 86400（24小时），最大 86400",
        },
      },
      required: ["key", "value"],
    },
    handler: async (args: ToolArgs) => {
      const sessionId = getToolSessionId();
      if (!sessionId) return toolError("无法获取当前 session ID");
      const ttl = Math.min(
        Math.max(1, (args.ttl_seconds as number) ?? 86400),
        86400,
      );
      try {
        await writeFridgeMagnet(sessionId, args.key as string, args.value as string, ttl);
        return toolResult({ ok: true, key: args.key, ttl });
      } catch (e) {
        return toolError(`冰箱贴写入失败: ${e}`);
      }
    },
  });
}
