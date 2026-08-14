import { z } from "zod";

export const limbicKindSchema = z.enum(["conversation_mood", "turning_point", "spike"]);
export type LimbicKind = z.infer<typeof limbicKindSchema>;
