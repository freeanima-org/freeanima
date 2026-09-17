import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await writeFile(path, bytes);
}

export async function readBytes(path: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path));
}

export async function runCommand(
  args: string[],
  opts?: { cwd?: string },
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const bin = args[0];
    if (!bin) {
      reject(new Error("command args empty"));
      return;
    }
    const proc = spawn(bin, args.slice(1), {
      cwd: opts?.cwd,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export async function removePath(path: string): Promise<void> {
  if (process.platform === "win32") {
    await runCommand([
      "powershell",
      "-NoProfile",
      "-Command",
      `Remove-Item -LiteralPath '${path.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`,
    ]);
    return;
  }
  await runCommand(["rm", "-rf", path]);
}
