import { z } from "zod";

export const mcpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    /** stdio | sse（旧 HTTP+SSE）| http（Streamable HTTP，连 Habitat /mcp 用这个） */
    transport: z.enum(["stdio", "sse", "http"]).optional(),
    /** @deprecated Prefer `headers.Authorization`; kept for runtime compat */
    api_key_env: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    connect_timeout_ms: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();
