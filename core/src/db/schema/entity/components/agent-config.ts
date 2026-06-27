import { z } from "zod";

export const AGENT_CONFIG_COMPONENT = "agent_config" as const;

/** 展示字段在 entities.title / summary / content */
export const agentConfigBodySchema = z.object({});

export type AgentConfigBody = z.infer<typeof agentConfigBodySchema>;
