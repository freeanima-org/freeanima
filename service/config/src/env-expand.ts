/**
 * Expand `${VAR}` and `${VAR:-default}` in config YAML.
 * Replace with empty string when unset and no default.
 */
const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function expandConfigEnv(raw: string): string {
  let result = "";
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "$" && raw[i + 1] === "{") {
      const close = raw.indexOf("}", i + 2);
      if (close === -1) {
        result += raw[i]!;
        i++;
        continue;
      }

      const inner = raw.slice(i + 2, close);
      const sep = inner.indexOf(":-");
      const name = sep === -1 ? inner : inner.slice(0, sep);
      const defaultValue = sep === -1 ? undefined : inner.slice(sep + 2);

      if (ENV_VAR_NAME.test(name)) {
        const v = process.env[name];
        if (v !== undefined && v !== "") result += v;
        else if (defaultValue !== undefined) result += defaultValue;
        i = close + 1;
        continue;
      }

      result += raw.slice(i, close + 1);
      i = close + 1;
      continue;
    }

    result += raw[i]!;
    i++;
  }

  return result;
}
