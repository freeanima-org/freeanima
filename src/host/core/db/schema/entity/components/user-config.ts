import { z } from "zod";

import { subjectConfigBodySchema } from "./subject-config.ts";

export const USER_CONFIG_COMPONENT = "user_config" as const;

/** 展示字段在 entities.title / summary / content */
export const userConfigBodySchema = subjectConfigBodySchema;

export type UserConfigBody = z.infer<typeof userConfigBodySchema>;
