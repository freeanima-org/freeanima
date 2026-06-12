export type CredentialPermission = {
  name: string;
  read: "allow" | "deny" | null;
  write: "allow" | "deny" | null;
};

export type Mask = {
  inherits: string[];
  allowed_tools: string[];
  denied_tools: string[];
  auto_skills: string[];
  credentials: CredentialPermission[];
};

/** Capability mask registry port (connectors / service via ServiceContext) */
export interface MaskRegistryPort {
  get(name: string): Mask | undefined;
  list(): { name: string; mask: Mask }[];
}
