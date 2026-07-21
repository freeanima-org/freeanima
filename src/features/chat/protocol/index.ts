/** Chat Feature Habitat RPC wire types — SSOT: `@freeanima/shared/rpc-contract/feature-rpc` (subset). */
export * from "@freeanima/shared/rpc-contract/frames/conversation";
export * from "@freeanima/shared/rpc-contract/frames/message";
export * from "@freeanima/shared/rpc-contract/frames/acp";
export {
  formatRemotePlatform,
  normalizeAppSlug,
  resolveDefaultRemotePlatform,
  type RemoteToolsRequestContext,
} from "@freeanima/shared/rpc-contract";
