import { USER_CONFIG_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { USER_CONFIG_COMPONENT };

import { z } from "zod";

import { subjectConfigBodySchema } from "./subject-config.ts";

/** 展示字段在 entities.title / summary / content */
export const userConfigBodySchema = subjectConfigBodySchema;

export type UserConfigBody = z.infer<typeof userConfigBodySchema>;
