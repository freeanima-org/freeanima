import { join } from "node:path";

const ENTRY = join(import.meta.dir, "src/shared-worker-entry.ts");

export async function buildSapSharedWorker(outdir: string): Promise<void> {
  const result = await Bun.build({
    entrypoints: [ENTRY],
    outdir,
    naming: "sap-shared-worker.[ext]",
    target: "browser",
    format: "esm",
  });

  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
}

if (import.meta.main) {
  const outdir = process.argv[2] ?? join(import.meta.dir, "dist");
  void buildSapSharedWorker(outdir).then(() => {
    console.log(`built sap-shared-worker -> ${outdir}/sap-shared-worker.js`);
  });
}
