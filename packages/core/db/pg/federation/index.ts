export * from "./types.ts";
export {
  listTrustedSatellites,
  getTrustedSatellite,
  upsertPendingSatellite,
  createTrustedSatellite,
  approveTrustedSatellite,
  rejectPendingSatellite,
  revokeTrustedSatellite,
} from "./repos/trusted-satellite-repo.ts";
