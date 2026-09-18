import { omitUndefined } from "@freeanima/core/util";

import type { HabitatTlsMaterial } from "./habitat-tls-material.ts";

/** Bun.serve TLS 选项（壳/服务端启动用）。 */
export type HabitatTlsBunOptions = {
  key: ReturnType<typeof Bun.file>;
  cert: ReturnType<typeof Bun.file>;
  passphrase?: string;
};

export function toHabitatTlsBunOptions(material: HabitatTlsMaterial): HabitatTlsBunOptions {
  return omitUndefined({
    key: Bun.file(material.keyPath),
    cert: Bun.file(material.certPath),
    ...(material.passphrase ? { passphrase: material.passphrase } : {}),
  });
}
