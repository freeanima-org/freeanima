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

/** 能力面罩注册表端口（connectors / service 通过 ServiceContext 访问） */
export interface MaskRegistryPort {
  get(name: string): Mask | undefined;
  list(): { name: string; mask: Mask }[];
}
