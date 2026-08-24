import type { habitatTrustedSatellites } from "@freeanima/habitat/core/db/schema/federation.ts";

export type TrustedSatelliteRow = typeof habitatTrustedSatellites.$inferSelect;

export type TrustedSatelliteCreateInput = {
  satellite_habitat_instance_id: string;
  satellite_public_key: string;
  label?: string | null;
  linked_contact_id?: number | null;
};
