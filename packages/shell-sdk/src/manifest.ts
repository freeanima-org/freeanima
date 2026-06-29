import { z } from "zod";

export const connectionKindSchema = z.enum(["embedded-sidecar", "sap-direct", "hub-rest"]);

export type ConnectionKind = z.infer<typeof connectionKindSchema>;

export const frontendManifestSchema = z.object({
  appId: z.string().min(1),
  displayName: z.string().min(1),
  version: z.string().min(1),
  supportsDesktop: z.boolean(),
  supportsMobile: z.boolean(),
  connectionKind: connectionKindSchema,
  sap: z
    .object({
      relay: z.boolean(),
      tools: z.boolean().optional(),
    })
    .optional(),
});

export type FrontendManifest = z.infer<typeof frontendManifestSchema>;

export function toManifestJson(manifest: FrontendManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function parseManifestJson(raw: string): FrontendManifest {
  return frontendManifestSchema.parse(JSON.parse(raw));
}
