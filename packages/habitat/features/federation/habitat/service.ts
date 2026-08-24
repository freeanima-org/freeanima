import { isFullTokenAuthorization } from "@freeanima/shared/service-api-auth";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import {
  federationPingMessage,
  federationPongMessage,
  encodeFederationFrame,
} from "@freeanima/habitat/capabilities/federation/handshake.ts";
import {
  approveTrustedSatellite,
  createTrustedSatellite,
  listTrustedSatellites,
  rejectPendingSatellite,
  revokeTrustedSatellite,
} from "@freeanima/habitat/core/db/pg/federation";
import {
  resolveFederationRole,
  FEDERATION_WS_PATH,
} from "@freeanima/habitat/capabilities/federation/config.ts";
import { getFederationManager } from "@freeanima/habitat/capabilities/federation/runtime-context.ts";
import { habitatCtx } from "@freeanima/features/habitat/habitat/habitat-api/handlers/runtime.ts";
import type { TrustedSatelliteRow } from "@freeanima/habitat/core/db/pg/federation";

export class FederationAccessError extends Error {
  readonly httpStatus = 403;
  constructor(message: string) {
    super(message);
    this.name = "FederationAccessError";
  }
}

function assertFederationAdmin(auth: RpcRequestAuthContext): void {
  if (auth.subject_type !== "user") {
    throw new FederationAccessError("仅 user 可管理联邦授信");
  }
  if (!isFullTokenAuthorization(auth.authorization)) {
    throw new FederationAccessError("联邦授信管理须 full authorization");
  }
}

function rowToDto(row: TrustedSatelliteRow, online: boolean) {
  return {
    satellite_habitat_instance_id: row.satellite_habitat_instance_id,
    satellite_public_key: row.satellite_public_key,
    label: row.label,
    status: row.status,
    linked_contact_id: row.linked_contact_id,
    created_at: row.created_at.toISOString(),
    trusted_at: row.trusted_at?.toISOString() ?? null,
    revoked_at: row.revoked_at?.toISOString() ?? null,
    online,
  };
}

function notifySatelliteTrusted(satellite_habitat_instance_id: string): void {
  const mgr = getFederationManager();
  const session = mgr?.hubRegistry.get(satellite_habitat_instance_id);
  if (!session) return;
  session.trust_state = "trusted";
  session.send(encodeFederationFrame("federation.trust.granted", {}));
}

export async function serviceFederationStatus() {
  const config = habitatCtx().engine.config.data;
  const role = resolveFederationRole(config.federation);
  const mgr = getFederationManager();
  const connection_state =
    role === "satellite" ? (mgr?.satelliteClient?.getState() ?? "disconnected") : null;
  return {
    role,
    enabled: config.federation?.enabled === true,
    hub_origin: config.federation?.hub?.origin ?? null,
    hub_instance_id: config.federation?.hub?.habitat_instance_id ?? null,
    connection_state,
    federation_ws_path: FEDERATION_WS_PATH,
  };
}

export async function serviceFederationSatelliteList(auth: RpcRequestAuthContext) {
  assertFederationAdmin(auth);
  const mgr = getFederationManager();
  const rows = await listTrustedSatellites();
  return {
    items: rows.map((row) =>
      rowToDto(row, mgr?.hubRegistry.isOnline(row.satellite_habitat_instance_id) ?? false),
    ),
  };
}

export async function serviceFederationSatelliteCreate(
  input: {
    satellite_habitat_instance_id: string;
    satellite_public_key: string;
    label?: string;
    linked_contact_id?: number;
    create_contact?: boolean;
  },
  auth: RpcRequestAuthContext,
) {
  assertFederationAdmin(auth);
  const role = resolveFederationRole(habitatCtx().engine.config.data.federation);
  if (role !== "hub") {
    throw new FederationAccessError("仅 Hub 可录入 Satellite 授信");
  }

  let linked_contact_id = input.linked_contact_id;
  if (input.create_contact && linked_contact_id == null) {
    const { createContact } = await import("@freeanima/features/contact/domain/index.ts");
    const { resolveContactWorldId } =
      await import("@freeanima/features/contact/domain/contact-world.ts");
    const title = input.label?.trim() || input.satellite_habitat_instance_id;
    const contact = await createContact(resolveContactWorldId(), {
      title,
      summary: `联邦 Satellite ${input.satellite_habitat_instance_id}`,
      animas: [
        {
          kind: "external" as const,
          public_id: input.satellite_habitat_instance_id,
          habitat_instance_id: input.satellite_habitat_instance_id,
          habitat_public_key: input.satellite_public_key,
        },
      ],
    });
    linked_contact_id = contact.id;
  }

  const row = await createTrustedSatellite({
    satellite_habitat_instance_id: input.satellite_habitat_instance_id,
    satellite_public_key: input.satellite_public_key,
    ...(input.label != null ? { label: input.label } : {}),
    ...(linked_contact_id != null ? { linked_contact_id } : {}),
  });
  return { item: rowToDto(row, false) };
}

export async function serviceFederationSatelliteApprove(
  input: {
    satellite_habitat_instance_id: string;
    label?: string;
    create_contact?: boolean;
  },
  auth: RpcRequestAuthContext,
) {
  assertFederationAdmin(auth);
  const role = resolveFederationRole(habitatCtx().engine.config.data.federation);
  if (role !== "hub") {
    throw new FederationAccessError("仅 Hub 可审批 Satellite 授信");
  }

  const existing = (await listTrustedSatellites()).find(
    (row) => row.satellite_habitat_instance_id === input.satellite_habitat_instance_id,
  );
  if (!existing) throw new Error("satellite not found");
  if (existing.status !== "pending") {
    throw new Error("satellite not pending");
  }

  let linked_contact_id = existing.linked_contact_id;
  if (input.create_contact && linked_contact_id == null) {
    const { createContact } = await import("@freeanima/features/contact/domain/index.ts");
    const { resolveContactWorldId } =
      await import("@freeanima/features/contact/domain/contact-world.ts");
    const title = input.label?.trim() || input.satellite_habitat_instance_id;
    const contact = await createContact(resolveContactWorldId(), {
      title,
      summary: `联邦 Satellite ${input.satellite_habitat_instance_id}`,
      animas: [
        {
          kind: "external" as const,
          public_id: input.satellite_habitat_instance_id,
          habitat_instance_id: input.satellite_habitat_instance_id,
          habitat_public_key: existing.satellite_public_key,
        },
      ],
    });
    linked_contact_id = contact.id;
  }

  const row = await approveTrustedSatellite(input.satellite_habitat_instance_id, {
    ...(input.label != null ? { label: input.label } : {}),
    linked_contact_id,
  });
  if (!row) throw new Error("approve failed");

  notifySatelliteTrusted(input.satellite_habitat_instance_id);
  const mgr = getFederationManager();
  return {
    item: rowToDto(row, mgr?.hubRegistry.isOnline(input.satellite_habitat_instance_id) ?? false),
  };
}

export async function serviceFederationSatelliteReject(
  input: { satellite_habitat_instance_id: string },
  auth: RpcRequestAuthContext,
) {
  assertFederationAdmin(auth);
  const role = resolveFederationRole(habitatCtx().engine.config.data.federation);
  if (role !== "hub") {
    throw new FederationAccessError("仅 Hub 可拒绝 Satellite 授信");
  }
  const mgr = getFederationManager();
  const session = mgr?.hubRegistry.get(input.satellite_habitat_instance_id);
  session?.close(4003, "rejected");
  const row = await rejectPendingSatellite(input.satellite_habitat_instance_id);
  if (!row) throw new Error("satellite not found");
  return { ok: true as const };
}

export async function serviceFederationSatelliteRevoke(
  input: { satellite_habitat_instance_id: string },
  auth: RpcRequestAuthContext,
) {
  assertFederationAdmin(auth);
  const role = resolveFederationRole(habitatCtx().engine.config.data.federation);
  if (role !== "hub") {
    throw new FederationAccessError("仅 Hub 可撤销 Satellite 授信");
  }
  const mgr = getFederationManager();
  const session = mgr?.hubRegistry.get(input.satellite_habitat_instance_id);
  session?.close(4003, "revoked");
  const row = await revokeTrustedSatellite(input.satellite_habitat_instance_id);
  if (!row) throw new Error("satellite not found");
  return { ok: true as const };
}

export async function serviceFederationPing(input: { message?: string }) {
  const config = habitatCtx().engine.config.data;
  const role = resolveFederationRole(config.federation);
  if (role === "disabled") {
    throw new Error("federation disabled");
  }
  const identity = config.identity;
  if (!identity) throw new Error("identity not configured");
  const message = federationPingMessage(input.message);
  return {
    pong: federationPongMessage(message),
    habitat_instance_id: identity.habitat_instance_id,
    role: role === "hub" ? ("hub" as const) : ("satellite" as const),
  };
}
