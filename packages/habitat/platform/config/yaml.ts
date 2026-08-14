import { YAML } from "bun";

export function parseYaml(text: string): unknown {
  return YAML.parse(text);
}

export function stringifyYaml(value: unknown): string {
  return YAML.stringify(value, null, 2);
}
