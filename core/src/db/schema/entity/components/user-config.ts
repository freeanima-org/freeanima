import { z } from "zod";

export const USER_CONFIG_COMPONENT = "user_config" as const;

/** 展示字段在 entities.title / summary / content */
export const userConfigBodySchema = z.object({});

export type UserConfigBody = z.infer<typeof userConfigBodySchema>;
