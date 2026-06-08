/**
 * 展开 config YAML 中的 `${VAR}` 与 `${VAR:-default}`。
 * 未设置且无默认值时替换为空字符串。
 */
export function expandConfigEnv(raw: string): string {
  return raw.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g,
    (_match, name: string, defaultValue?: string) => {
      const v = process.env[name];
      if (v !== undefined && v !== "") return v;
      if (defaultValue !== undefined) return defaultValue;
      return "";
    },
  );
}
