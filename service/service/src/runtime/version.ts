import { readAppVersion } from "./root-version.ts";

/** 与根 package.json version 同步（发版时 bump 根目录即可） */
export const ANIMA_VERSION: string = readAppVersion();
