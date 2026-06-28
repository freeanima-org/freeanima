import type { EntityType } from "@freeanima/core/db/schema";
import type { EntityRow } from "@freeanima/core/db/schema/entity";

export type { EntityRow };

export type EntityCreateInput = {
  type: EntityType;
  world_id: number;
  components: string[];
  primary_component: string;
  title?: string;
  summary?: string;
  content?: string;
  body: Record<string, unknown>;
};

export type EntityUpdateInput = {
  id: number;
  world_id?: number;
  components?: string[];
  title?: string;
  summary?: string;
  content?: string;
  body?: Record<string, unknown>;
};

export type EntityListOpts = {
  world_id?: number;
  type?: EntityType;
  types?: EntityType[];
  primary_component?: string;
  component?: string;
  limit?: number;
  offset?: number;
};

export interface EntityStorePort {
  create(input: EntityCreateInput): Promise<EntityRow>;
  get(id: number): Promise<EntityRow | null>;
  update(input: EntityUpdateInput): Promise<EntityRow | null>;
  delete(id: number): Promise<boolean>;
  list(opts?: EntityListOpts): Promise<EntityRow[]>;
  count(opts?: Omit<EntityListOpts, "offset" | "limit">): Promise<number>;
}
