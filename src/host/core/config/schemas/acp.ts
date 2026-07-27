import { z } from "zod";

export const acpAgentSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    description: z.string().optional(),
    adapter: z.string().optional(),
    plan_mode: z.union([z.string(), z.boolean()]).optional(),
    agent_mode: z.string().optional(),
    /** Cursor ACP model; `auto` means Auto (default[]); default cursor adapter is also auto */
    model: z.string().optional(),
    url: z.string().optional(),
    transport: z.enum(["stdio", "sse"]).optional(),
    name: z.string().optional(),
    /** Connection timeout (ms), default 15000; for initialize / authenticate / session/new etc. */
    connect_timeout_ms: z.number().int().positive().optional(),
    /** Prompt timeout (ms), default 120000; for session/prompt */
    prompt_timeout_ms: z.number().int().positive().optional(),
    /** Auto-connect on freeanima startup, default true */
    enabled: z.boolean().optional(),
    /** Health check interval (ms), default 60000; 0 disables */
    health_check_interval_ms: z.number().int().nonnegative().optional(),
    /** Session TTL (ms), default 0 (no expiry) */
    session_ttl_ms: z.number().int().nonnegative().optional(),
    /** Retry once after prompt timeout, default true */
    prompt_retry_once: z.boolean().optional(),
    /** Auto-restart after child crash, default true */
    auto_restart: z.boolean().optional(),
    /** Max concurrent async tasks per agent (separate subprocess each), default 3 */
    max_concurrent_tasks: z.number().int().positive().optional(),
  })
  .passthrough();
