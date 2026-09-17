import { AGENT_CONFIG_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { AGENT_CONFIG_COMPONENT };

import { z } from "zod";

import { subjectConfigBodySchema } from "./subject-config.ts";

/** 展示字段在 entities.title / summary / content */
export const agentConfigBodySchema = subjectConfigBodySchema;

export type AgentConfigBody = z.infer<typeof agentConfigBodySchema>;
