import { z } from "zod";

export const WORLD_CONFIG_COMPONENT = "world_config" as const;

/** 展示字段在 entities.title / summary / content */
export const worldConfigBodySchema = z.object({});

export type WorldConfigBody = z.infer<typeof worldConfigBodySchema>;
