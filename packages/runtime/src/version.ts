import { readRootVersion } from "./root-version.js";

/** 与根 package.json version 同步（发版时 bump 根目录即可） */
export const NEST_VERSION: string = readRootVersion();
