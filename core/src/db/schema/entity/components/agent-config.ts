import { z } from "zod";

import { subjectConfigBodySchema } from "./subject-config.ts";

export const AGENT_CONFIG_COMPONENT = "agent_config" as const;

/** 展示字段在 entities.title / summary / content */
export const agentConfigBodySchema = subjectConfigBodySchema;

export type AgentConfigBody = z.infer<typeof agentConfigBodySchema>;
