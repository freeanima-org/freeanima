import { readAppVersion } from "./root-version.ts";

/** Synced with root package.json version (bump root on release) */
export const ANIMA_VERSION: string = readAppVersion();
