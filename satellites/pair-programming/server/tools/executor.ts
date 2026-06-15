import { readStudioFile } from "../studio.ts";

export async function executeLocalTool(
  localName: string,
  args: Record<string, unknown>,
  workspaceRoot: string,
): Promise<string> {
  switch (localName) {
    case "scan_code":
      return JSON.stringify({ ok: true, workspace: workspaceRoot, scanned: true });
    case "file_read_file": {
      const path = String(args.path ?? args.file ?? "");
      const file = readStudioFile(path);
      return file.content;
    }
    default:
      return JSON.stringify({ error: `unsupported local tool: ${localName}` });
  }
}
