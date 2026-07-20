/** Chat Feature Habitat RPC wire types — SSOT: `@freeanima/sap-contract/feature-rpc` (subset). */
export * from "@freeanima/shared/sap-contract/frames/conversation";
export * from "@freeanima/shared/sap-contract/frames/message";
export * from "@freeanima/shared/sap-contract/frames/acp";
export {
  formatSapPlatform,
  normalizeAppSlug,
  resolveDefaultSapPlatform,
  type SapRequestContext,
} from "@freeanima/shared/sap-contract";
