import { describe, expect, test } from "bun:test";

import { OBJECTIVE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
import {
  componentBodySchema,
  OBJECTIVE_COMPONENT as SCHEMA_OBJECTIVE,
  objectiveBodySchema,
} from "@freeanima/habitat/core/db/schema/entity/components/index.ts";

describe("objective component registration", () => {
  test("component id matches", () => {
    expect(OBJECTIVE_COMPONENT).toBe("objective");
    expect(SCHEMA_OBJECTIVE).toBe(OBJECTIVE_COMPONENT);
  });

  test("body schema registered", () => {
    const schema = componentBodySchema(OBJECTIVE_COMPONENT);
    expect(schema).toBe(objectiveBodySchema);
  });
});
