/** User 库中 Agent 根密钥 SSOT 的幂等标识（import_refs.agent_root_key）。 */
export const AGENT_ROOT_KEY_REF = "habitat" as const;

export const AGENT_ROOT_KEY_ITEM_TITLE = "Habitat Agent root key" as const;

/** secrets.password 存放 root key 的 base64（32 raw bytes）。 */
export const AGENT_ROOT_KEY_SECRET_FIELD = "password" as const;
