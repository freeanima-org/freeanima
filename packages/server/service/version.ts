import { readAppVersion } from "@freeanima/server/config";

/** Synced with root package.json version (bump root on release) */
export const ANIMA_VERSION: string = readAppVersion();
