import { HookRegistry } from "@freeanima/hooks";
import { Kernel } from "@freeanima/kernel";

export const kernel = new Kernel(new HookRegistry());
