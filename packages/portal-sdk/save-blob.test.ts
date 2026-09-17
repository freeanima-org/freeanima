import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { hasNativeBlobSave, saveOrDownloadBlob } from "./save-blob.ts";
import type { ShellApi, ShellSaveBlobResult } from "./shell-api.ts";

type FakeAnchor = {
  href: string;
  download: string;
  rel: string;
  style: { display: string };
  click: () => void;
  remove: () => void;
};

const originalCreateObjectURL = URL.createObjectURL.bind(URL);
const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
const prevWindow = (globalThis as { window?: Window }).window;
const prevDocument = (globalThis as { document?: Document }).document;

let lastAnchor: FakeAnchor | null = null;
let appended: FakeAnchor | null = null;
let revokeCalls = 0;

beforeEach(() => {
  lastAnchor = null;
  appended = null;
  revokeCalls = 0;
  URL.createObjectURL = mock(() => "blob:mock-file");
  URL.revokeObjectURL = mock(() => {
    revokeCalls += 1;
  });
  const body = {
    appendChild(node: FakeAnchor) {
      appended = node;
      return node;
    },
  };
  const document = {
    body,
    createElement(tag: string) {
      if (tag.toLowerCase() !== "a") {
        throw new Error(`unexpected tag ${tag}`);
      }
      const a: FakeAnchor = {
        href: "",
        download: "",
        rel: "",
        style: { display: "" },
        click: mock(() => {}),
        remove: mock(() => {}),
      };
      lastAnchor = a;
      return a;
    },
  };
  (globalThis as { document?: unknown }).document = document;
  (globalThis as { window?: unknown }).window = globalThis;
  delete (globalThis as { portalShell?: ShellApi }).portalShell;
});

afterEach(() => {
  delete (globalThis as { portalShell?: ShellApi }).portalShell;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  if (prevWindow) (globalThis as { window?: Window }).window = prevWindow;
  else delete (globalThis as { window?: Window }).window;
  if (prevDocument) (globalThis as { document?: Document }).document = prevDocument;
  else delete (globalThis as { document?: Document }).document;
});

describe("saveOrDownloadBlob", () => {
  it("无 saveBlob 时走 a[download] 且挂到 DOM", async () => {
    expect(hasNativeBlobSave()).toBe(false);
    const blob = new Blob(["hi"], { type: "text/plain" });
    const result = await saveOrDownloadBlob(blob, "note.txt");
    expect(result).toEqual({ native: false, cancelled: false });
    expect(lastAnchor?.download).toBe("note.txt");
    expect(lastAnchor?.href).toContain("blob:");
    expect(appended).toBe(lastAnchor);
    expect(revokeCalls).toBe(0);
  });

  it("有 saveBlob 时把字节交给壳且取消不当失败", async () => {
    const saveBlob = mock(
      async (opts: { filename: string; bytes: Uint8Array; mimeType?: string }) => {
        expect(opts.filename).toBe("pic.png");
        expect(opts.mimeType).toBe("image/png");
        expect(Array.from(opts.bytes)).toEqual([1, 2, 3]);
        return { cancelled: true } satisfies ShellSaveBlobResult;
      },
    );
    (globalThis as { portalShell?: ShellApi }).portalShell = { saveBlob } as unknown as ShellApi;
    (globalThis as { window?: { portalShell?: ShellApi } }).window = globalThis as unknown as {
      portalShell?: ShellApi;
    } & Window;
    expect(hasNativeBlobSave()).toBe(true);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const result = await saveOrDownloadBlob(blob, "pic.png");
    expect(result).toEqual({ native: true, cancelled: true });
    expect(saveBlob).toHaveBeenCalledTimes(1);
    expect(lastAnchor).toBeNull();
  });

  it("原生保存成功带回 path", async () => {
    (globalThis as { portalShell?: ShellApi }).portalShell = {
      saveBlob: async () => ({ path: "/tmp/a.bin" }),
    } as unknown as ShellApi;
    (globalThis as { window?: { portalShell?: ShellApi } }).window = globalThis as unknown as {
      portalShell?: ShellApi;
    } & Window;
    const result = await saveOrDownloadBlob(new Blob(["x"]), "a.bin");
    expect(result).toEqual({ native: true, cancelled: false, path: "/tmp/a.bin" });
  });
});
