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

export type ResolvedMask = {
  allowed_tools: readonly string[];
  denied_tools: readonly string[];
  auto_skills: readonly string[];
  credentials: readonly CredentialPermission[];
};

export type SessionCapabilityMask = {
  presets: string[];
};
