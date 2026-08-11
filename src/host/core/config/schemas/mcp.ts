import { z } from "zod";

export const mcpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    /** stdio | sse（旧 HTTP+SSE，仍可用）| http（Streamable HTTP，连 Habitat /mcp 用这个） */
    transport: z.enum(["stdio", "sse", "http"]).optional(),
    /**
     * 遗留：环境变量名 → Bearer。新配置请用
     * `headers.Authorization: Bearer env("KEY")`（PG 已有迁移）。
     */
    api_key_env: z.string().optional(),
    /** 请求头；值可含 `env("KEY")`（连接时展开） */
    headers: z.record(z.string(), z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    connect_timeout_ms: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();
