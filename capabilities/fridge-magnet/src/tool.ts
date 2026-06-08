import { getToolSessionId } from "@freeanima/engine-loop";
import { registerTool, toolResult, toolError, type ToolArgs } from "@freeanima/engine-tool";
import { clampTtl, magnetRedisKey, randomBase62, setMagnet } from "./store.ts";

export function registerWriteFridgeMagnetTool(): void {
  registerTool({
    name: "write_fridge_magnet",
    description:
      "在冰箱贴上写一张便签。冰箱贴是跨轮对话的临时状态共享黑板，贴在当前 session 中，有过期时间。key 可选；不传则自动生成 4 位随机 ID。",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "便签名称（可选），如 sky_mood；省略则自动生成" },
        value: { type: "string", description: "便签内容" },
        ttl_seconds: {
          type: "number",
          description: "过期时间（秒），默认 86400（24小时），最大 86400",
        },
      },
      required: ["value"],
    },
    handler: async (args: ToolArgs) => {
      const sessionId = getToolSessionId();
      if (!sessionId) return toolError("无法获取当前 session ID");
      const value = String(args.value ?? "").trim();
      if (!value) return toolError("value 不能为空");
      const label = String(args.key ?? "").trim() || randomBase62(4);
      const ttl = clampTtl(args.ttl_seconds as number | undefined);
      const magnetId = `${sessionId}:${label}`;
      await setMagnet("session", magnetId, value, ttl);
      return toolResult({
        ok: true,
        redis_key: magnetRedisKey("session", magnetId),
        label,
        ttl,
      });
    },
  });
}
