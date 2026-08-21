import {
  attachToolReturns,
  toolError,
  toolResult,
  resolveToolCallerSubjectId,
} from "@freeanima/habitat/core/tool";
import {
  addEntityComponent,
  assertSubjectCanAccessWorld,
  deleteEntityComponent,
  EntityDeleteError,
  getEntity,
  promoteEntityComponent,
  ToolWorldAccessError,
} from "@freeanima/habitat/core/db/pg/entity";
import { coerceString } from "@freeanima/shared/coerce-string";
import { asRecord } from "@freeanima/shared/util";

import { EntityAttachError, assertAttachAllowed, assertPromoteAllowed } from "./attach-policy.ts";

function morphPayload(row: { id: number; components: string[]; primary_component: string | null }) {
  return {
    id: row.id,
    components: row.components,
    primary_component: row.primary_component,
  };
}

function mapMorphError(e: unknown): string | null {
  if (e instanceof ToolWorldAccessError) return e.message;
  if (e instanceof EntityAttachError) return e.message;
  if (e instanceof EntityDeleteError) return e.message;
  if (e instanceof Error) {
    if (e.message.startsWith("invalid body for component")) return e.message;
    if (e.message.startsWith("unknown component")) return e.message;
  }
  return null;
}

async function loadWritableEntity(id: number) {
  const row = await getEntity(id);
  if (!row) {
    throw new EntityAttachError(`entity not found: ${id}`);
  }
  await assertSubjectCanAccessWorld(resolveToolCallerSubjectId(), row.world_id, {
    access: "write",
  });
  return row;
}

function parsePositiveId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseBody(raw: unknown): Record<string, unknown> | string {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return asRecord(raw) ?? {};
  }
  return "body must be an object";
}

export function buildEntityMorphToolDefs() {
  return attachToolReturns(
    [
      {
        name: "entity_attach_component",
        description:
          "Morph attach: append a known component onto an existing content entity (same id). " +
          "Merges body fields; default keeps primary_component. Set promote_primary=true to make the new component primary. " +
          "Fails on identity components (world_config/agent_config/user_config) or non-content entities.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "integer", description: "entities.id" },
            component: {
              type: "string",
              description: "Component id to attach (e.g. task_item, diary_entry)",
            },
            body: {
              type: "object",
              additionalProperties: true,
              description: "Fields for the new component (merged into flat body)",
            },
            promote_primary: {
              type: "boolean",
              description: "If true, new component becomes primary_component (default false)",
            },
          },
          required: ["id", "component"],
        },
        handler: async (args) => {
          const id = parsePositiveId(args.id);
          if (id == null) return toolError("id must be a positive integer");
          const component = coerceString(args.component ?? "").trim();
          if (!component) return toolError("component is required");
          const bodyOrErr = parseBody(args.body);
          if (typeof bodyOrErr === "string") return toolError(bodyOrErr);
          try {
            const existing = await loadWritableEntity(id);
            assertAttachAllowed(existing, component);
            const row = await addEntityComponent({
              id,
              component,
              body: bodyOrErr,
              ...(args.promote_primary === true ? { promote_primary: true } : {}),
            });
            if (!row) return toolError(`entity not found: ${id}`);
            return toolResult(morphPayload(row));
          } catch (e) {
            const mapped = mapMorphError(e);
            if (mapped) return toolError(mapped);
            throw e;
          }
        },
      },
      {
        name: "entity_detach_component",
        description:
          "Morph detach: remove one component from an entity. Shared body keys needed by remaining components are kept.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "integer", description: "entities.id" },
            component: { type: "string", description: "Component id to remove" },
          },
          required: ["id", "component"],
        },
        handler: async (args) => {
          const id = parsePositiveId(args.id);
          if (id == null) return toolError("id must be a positive integer");
          const component = coerceString(args.component ?? "").trim();
          if (!component) return toolError("component is required");
          try {
            await loadWritableEntity(id);
            const row = await deleteEntityComponent(id, component);
            if (!row) return toolError(`entity not found: ${id}`);
            return toolResult(morphPayload(row));
          } catch (e) {
            const mapped = mapMorphError(e);
            if (mapped) return toolError(mapped);
            throw e;
          }
        },
      },
      {
        name: "entity_promote_component",
        description:
          "Morph promote: set primary_component to an already-attached secondary component. " +
          "Does not change components[] or body (unlike retype).",
        parameters: {
          type: "object",
          properties: {
            id: { type: "integer", description: "entities.id" },
            component: {
              type: "string",
              description: "Existing component id to become primary_component",
            },
          },
          required: ["id", "component"],
        },
        handler: async (args) => {
          const id = parsePositiveId(args.id);
          if (id == null) return toolError("id must be a positive integer");
          const component = coerceString(args.component ?? "").trim();
          if (!component) return toolError("component is required");
          try {
            const existing = await loadWritableEntity(id);
            assertPromoteAllowed(existing, component);
            const row = await promoteEntityComponent({ id, component });
            if (!row) return toolError(`entity not found: ${id}`);
            return toolResult(morphPayload(row));
          } catch (e) {
            const mapped = mapMorphError(e);
            if (mapped) return toolError(mapped);
            throw e;
          }
        },
      },
    ],
    {},
  );
}
