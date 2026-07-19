import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/core/util/temp-dir";

import { applyStandaloneUpgrade } from "./apply-standalone-upgrade.ts";
import {
  commitsMatch,
  extractReleaseCommit,
  extractReleaseVersion,
  CANARY_RELEASE_TAG,
} from "./github-releases.ts";
import { matchReleaseAsset } from "./release-assets.ts";
import { resolvePackagedUpdate } from "./resolve-packaged-update.ts";
import {
  compareCanaryVersion,
  compareSemver,
  extractBuildStamp,
  isCanaryVersionNewer,
  isConcreteCanaryVersion,
  isSemverNewer,
  normalizeSemver,
} from "./semver.ts";

const tempDirs: string[] = [];
const prevHome = process.env.FREEANIMA_HOME;

afterEach(() => {
  for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
});

function useTempHome(): string {
  const home = createTempDir("freeanima-apply-upgrade-");
  tempDirs.push(home);
  process.env.FREEANIMA_HOME = home;
  return home;
}

async function buildTestTarball(workDir: string): Promise<Buffer> {
  const pkg = join(workDir, "pkg");
  mkdirSync(pkg, { recursive: true });
  const animaPath = join(pkg, "anima");
  writeFileSync(animaPath, "#!/bin/sh\necho test\n");
  chmodSync(animaPath, 0o755);
  const tarball = join(workDir, "anima-linux-x64.tar.gz");
  const proc = Bun.spawn(["tar", "-czf", tarball, "-C", pkg, "anima"], {
    stdout: "ignore",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`tar create failed: ${err || code}`);
  }
  return readFileSync(tarball);
}

function releaseJson(tarUrl: string, size?: number) {
  return {
    tag_name: "v0.9.0",
    prerelease: false,
    draft: false,
    html_url: "https://github.com/freeanima-org/freeanima/releases/tag/v0.9.0",
    assets: [
      {
        name: "anima-linux-x64.tar.gz",
        browser_download_url: tarUrl,
        ...(size != null ? { size } : {}),
      },
    ],
  };
}

function mockReleaseFetch(tarBytes: Buffer, contentLength?: number): typeof fetch {
  return (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/releases/latest") || u.includes("/releases?")) {
      return new Response(
        JSON.stringify(releaseJson("https://example.com/anima-linux-x64.tar.gz")),
        {
          status: 200,
        },
      );
    }
    if (u.includes("anima-linux-x64.tar.gz")) {
      return new Response(new Uint8Array(tarBytes), {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          ...(contentLength != null ? { "content-length": String(contentLength) } : {}),
        },
      });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("semver", () => {
  it("normalizes and compares", () => {
    expect(normalizeSemver("v0.8.5")).toBe("0.8.5");
    expect(compareSemver("0.8.5", "0.8.4")).toBe(1);
    expect(compareSemver("0.8.5", "v0.8.5")).toBe(0);
    expect(isSemverNewer("0.9.0", "0.8.5")).toBe(true);
    expect(isSemverNewer("0.8.5", "0.8.5")).toBe(false);
  });

  it("compares canary build stamps after base semver", () => {
    expect(extractBuildStamp("0.9.1-canary+202607160848")).toBe("202607160848");
    expect(isConcreteCanaryVersion("0.9.1-canary+202607160949")).toBe(true);
    expect(isConcreteCanaryVersion("canary")).toBe(false);
    expect(compareCanaryVersion("0.9.1-canary+202607160949", "0.9.1-canary+202607160848")).toBe(1);
    expect(compareCanaryVersion("0.9.1-canary+202607160848", "0.9.1-canary+202607160949")).toBe(-1);
    expect(compareCanaryVersion("0.9.2-canary+202607160848", "0.9.1-canary+202607160949")).toBe(1);
    expect(isCanaryVersionNewer("0.9.1-canary+202607160949", "0.9.1-canary+202607160848")).toBe(
      true,
    );
    expect(isCanaryVersionNewer("0.9.1-canary+202607160848", "0.9.1-canary+202607160848")).toBe(
      false,
    );
  });
});

describe("matchReleaseAsset", () => {
  it("matches exact names", () => {
    const assets = [
      { name: "anima-linux-x64.tar.gz", browser_download_url: "https://example/a" },
      {
        name: "freeanima-desktop-windows-x64-setup.exe",
        browser_download_url: "https://example/d",
      },
    ];
    expect(matchReleaseAsset("standalone-linux-x64", assets)?.name).toBe("anima-linux-x64.tar.gz");
    expect(matchReleaseAsset("desktop-windows", assets)?.name).toBe(
      "freeanima-desktop-windows-x64-setup.exe",
    );
    expect(matchReleaseAsset("mobile-android", assets)).toBeNull();
  });
});

describe("extractReleaseCommit / extractReleaseVersion / commitsMatch", () => {
  it("parses sha from target_commitish or body", () => {
    expect(extractReleaseCommit({ target_commitish: "abc1234def" })).toBe("abc1234def");
    expect(extractReleaseCommit({ target_commitish: "main" })).toBeUndefined();
    expect(extractReleaseCommit({ body: "Canary\n\nsha: deadbeefcafebabe\n" })).toBe(
      "deadbeefcafebabe",
    );
    expect(commitsMatch("deadbeef", "deadbeefcafebabe")).toBe(true);
    expect(commitsMatch("aaaa", "bbbb")).toBe(false);
  });

  it("parses version from release body", () => {
    expect(
      extractReleaseVersion({
        body: "Rolling\n\nversion: `0.9.1-canary+202607160949`\nsha: `abc`\n",
      }),
    ).toBe("0.9.1-canary+202607160949");
    expect(extractReleaseVersion({ body: "version: 0.9.1-canary+202607160848\n" })).toBe(
      "0.9.1-canary+202607160848",
    );
    expect(extractReleaseVersion({ body: "no version here" })).toBeUndefined();
  });
});

describe("resolvePackagedUpdate", () => {
  it("requires newer tag and matching asset on release track", async () => {
    const release = {
      tag_name: "v0.9.0",
      prerelease: false,
      draft: false,
      html_url: "https://github.com/freeanima-org/freeanima/releases/tag/v0.9.0",
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/anima-linux-x64.tar.gz",
          size: 10,
        },
      ],
    };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(release), { status: 200 })) as unknown as typeof fetch;

    const up = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(up.available).toBe(true);
    if (up.available) {
      expect(up.assetUrl).toContain("anima-linux-x64.tar.gz");
      expect(up.remoteVersion).toBe("v0.9.0");
      expect(up.track).toBe("release");
    }

    const same = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.9.0",
      channel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(same).toEqual({
      available: false,
      reason: "up_to_date",
      remoteVersion: "v0.9.0",
      track: "release",
    });

    const noApk = await resolvePackagedUpdate({
      kind: "mobile-android",
      localVersion: "0.8.5",
      channel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(noApk).toEqual({
      available: false,
      reason: "no_asset",
      remoteVersion: "v0.9.0",
      track: "release",
    });
  });

  it("uses canary version string comparison when body has version", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const remoteVer = "0.9.1-canary+202607160949";
    const release = {
      tag_name: CANARY_RELEASE_TAG,
      prerelease: true,
      draft: false,
      html_url: "https://github.com/freeanima-org/freeanima/releases/tag/canary",
      target_commitish: sha,
      body: `version: \`${remoteVer}\`\nsha: \`${sha}\``,
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/canary.tgz",
        },
      ],
    };
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/releases/tags/canary")) {
        return new Response(JSON.stringify(release), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const newer = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.9.1-canary+202607160848",
      channel: "canary",
      localCommit: sha, // same commit must not block when stamp is newer
      fetchOptions: { fetchImpl },
    });
    expect(newer.available).toBe(true);
    if (newer.available) {
      expect(newer.remoteVersion).toBe(remoteVer);
      expect(newer.remoteCommit).toBe(sha);
    }

    const sameStamp = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: remoteVer,
      channel: "canary",
      localCommit: "aaaaaaaa", // different commit ignored when versions equal
      fetchOptions: { fetchImpl },
    });
    expect(sameStamp.available).toBe(false);
    if (!sameStamp.available) {
      expect(sameStamp.reason).toBe("up_to_date");
      expect(sameStamp.remoteVersion).toBe(remoteVer);
    }
  });

  it("falls back to commit comparison when body has no version", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const release = {
      tag_name: CANARY_RELEASE_TAG,
      prerelease: true,
      draft: false,
      html_url: "https://github.com/freeanima-org/freeanima/releases/tag/canary",
      target_commitish: sha,
      body: `sha: ${sha}`,
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/canary.tgz",
        },
      ],
    };
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/releases/tags/canary")) {
        return new Response(JSON.stringify(release), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const newer = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "canary",
      localCommit: "aaaaaaaa",
      fetchOptions: { fetchImpl },
    });
    expect(newer.available).toBe(true);
    if (newer.available) expect(newer.remoteCommit).toBe(sha);

    const same = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "canary",
      localCommit: sha.slice(0, 12),
      fetchOptions: { fetchImpl },
    });
    expect(same.available).toBe(false);
    if (!same.available) expect(same.reason).toBe("up_to_date");
  });

  it("switch intent returns tip without semver gate", async () => {
    const release = {
      tag_name: "v0.8.5",
      prerelease: false,
      draft: false,
      html_url: "https://example/r",
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/a.tgz",
        },
      ],
    };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(release), { status: 200 })) as unknown as typeof fetch;

    const sw = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.9.0",
      channel: "canary",
      intent: "switch",
      targetChannel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(sw.available).toBe(true);
  });

  it("rejects dev channel", async () => {
    const r = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "dev",
    });
    expect(r).toEqual({ available: false, reason: "unsupported_channel" });
  });
});

describe("applyStandaloneUpgrade", () => {
  it("does not call beforeReplace when up_to_date", async () => {
    useTempHome();
    const prefix = createTempDir("freeanima-prefix-");
    tempDirs.push(prefix);
    let called = false;
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v0.8.5",
          prerelease: false,
          draft: false,
          assets: [
            {
              name: "anima-linux-x64.tar.gz",
              browser_download_url: "https://example.com/a.tgz",
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const result = await applyStandaloneUpgrade({
      prefix,
      localVersion: "0.8.5",
      channel: "release",
      fetchOptions: { fetchImpl },
      beforeReplace: () => {
        called = true;
      },
    });

    expect(result.status).toBe("up_to_date");
    expect(called).toBe(false);
  });

  it("does not call beforeReplace when download fails", async () => {
    useTempHome();
    const prefix = createTempDir("freeanima-prefix-");
    tempDirs.push(prefix);
    let called = false;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/releases/latest")) {
        return new Response(JSON.stringify(releaseJson("https://example.com/missing.tgz")), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    await expect(
      applyStandaloneUpgrade({
        prefix,
        localVersion: "0.8.5",
        channel: "release",
        fetchOptions: { fetchImpl },
        beforeReplace: () => {
          called = true;
        },
      }),
    ).rejects.toThrow("下载失败");

    expect(called).toBe(false);
  });

  it("does not call beforeReplace when tarball is invalid", async () => {
    useTempHome();
    const prefix = createTempDir("freeanima-prefix-");
    tempDirs.push(prefix);
    let called = false;
    const fetchImpl = mockReleaseFetch(Buffer.from("not-a-tarball"));

    await expect(
      applyStandaloneUpgrade({
        prefix,
        localVersion: "0.8.5",
        channel: "release",
        fetchOptions: { fetchImpl },
        beforeReplace: () => {
          called = true;
        },
      }),
    ).rejects.toThrow();

    expect(called).toBe(false);
  });

  it("calls beforeReplace after staging and replaces anima binary", async () => {
    useTempHome();
    const work = createTempDir("freeanima-upgrade-work-");
    tempDirs.push(work);
    const prefix = join(work, "standalone");
    mkdirSync(prefix, { recursive: true });
    writeFileSync(join(prefix, "anima"), "old-binary\n");

    const tarBytes = await buildTestTarball(work);
    const fetchImpl = mockReleaseFetch(tarBytes, tarBytes.byteLength);
    const phases: string[] = [];

    const result = await applyStandaloneUpgrade({
      prefix,
      localVersion: "0.8.5",
      channel: "release",
      fetchOptions: { fetchImpl },
      beforeReplace: () => {
        phases.push("beforeReplace");
        expect(readFileSync(join(prefix, "anima"), "utf8")).toBe("old-binary\n");
      },
    });

    expect(result.status).toBe("upgraded");
    expect(phases).toEqual(["beforeReplace"]);
    expect(readFileSync(join(prefix, "anima"), "utf8")).toBe("#!/bin/sh\necho test\n");
    expect(existsSync(join(prefix, "anima"))).toBe(true);
  });

  it("rejects download when asset size header mismatches", async () => {
    useTempHome();
    const work = createTempDir("freeanima-upgrade-size-");
    tempDirs.push(work);
    const prefix = join(work, "standalone");
    mkdirSync(prefix, { recursive: true });
    const tarBytes = await buildTestTarball(work);
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/releases/latest") || u.includes("/releases?")) {
        return new Response(
          JSON.stringify(releaseJson("https://example.com/anima-linux-x64.tar.gz", 999)),
          { status: 200 },
        );
      }
      if (u.includes("anima-linux-x64.tar.gz")) {
        return new Response(new Uint8Array(tarBytes), {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(tarBytes.byteLength),
          },
        });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    let called = false;

    await expect(
      applyStandaloneUpgrade({
        prefix,
        localVersion: "0.8.5",
        channel: "release",
        fetchOptions: { fetchImpl },
        beforeReplace: () => {
          called = true;
        },
      }),
    ).rejects.toThrow("下载大小不符");

    expect(called).toBe(false);
  });

  it("reports download progress via onDownloadProgress", async () => {
    useTempHome();
    const work = createTempDir("freeanima-upgrade-progress-");
    tempDirs.push(work);
    const prefix = join(work, "standalone");
    mkdirSync(prefix, { recursive: true });
    writeFileSync(join(prefix, "anima"), "old\n");
    const tarBytes = await buildTestTarball(work);
    const fetchImpl = mockReleaseFetch(tarBytes, tarBytes.byteLength);
    const progress: Array<{ received: number; total: number | null }> = [];

    const result = await applyStandaloneUpgrade({
      prefix,
      localVersion: "0.8.5",
      channel: "release",
      fetchOptions: { fetchImpl },
      cliProgressTty: false,
      onDownloadProgress: (p) => progress.push(p),
    });

    expect(result.status).toBe("upgraded");
    expect(progress.length).toBeGreaterThan(0);
    const last = progress.at(-1);
    expect(last?.received).toBe(tarBytes.byteLength);
    expect(last?.total).toBe(tarBytes.byteLength);
  });
});

describe("cli download progress", () => {
  it("formats wget-like line with percent bar", async () => {
    const { formatCliDownloadProgressLine, formatHumanBytes } =
      await import("./cli-download-progress.ts");
    expect(formatHumanBytes(1536)).toBe("1.5K");
    const line = formatCliDownloadProgressLine({
      fileName: "anima-linux-x64.tar.gz",
      received: 45,
      total: 100,
      barWidth: 10,
      bytesPerSecond: 1024 * 1024 * 1.2,
    });
    expect(line).toContain("45%");
    expect(line).toContain("anima-linux-x64.tar.gz");
    expect(line).toContain("[");
    expect(line).toContain(">");
    expect(line).toContain("/s");
  });

  it("TTY sink rewrites with carriage return; non-TTY stays silent", async () => {
    const { createCliDownloadProgressSink } = await import("./cli-download-progress.ts");
    const { Writable } = await import("node:stream");
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(String(chunk));
        cb();
      },
    });
    const tty = createCliDownloadProgressSink({
      fileName: "a.tar.gz",
      stream,
      isTty: true,
    });
    tty.onProgress({ received: 10, total: 100 });
    tty.finish();
    expect(chunks[0]?.startsWith("\r")).toBe(true);
    expect(chunks.at(-1)).toBe("\n");

    const silentChunks: string[] = [];
    const silentStream = new Writable({
      write(chunk, _enc, cb) {
        silentChunks.push(String(chunk));
        cb();
      },
    });
    const silent = createCliDownloadProgressSink({
      fileName: "a.tar.gz",
      stream: silentStream,
      isTty: false,
    });
    silent.onProgress({ received: 10, total: 100 });
    silent.finish();
    expect(silentChunks).toEqual([]);
  });
});

describe("downloadReleaseAsset progress", () => {
  it("invokes onProgress with content-length total", async () => {
    const { downloadReleaseAsset } = await import("./download.ts");
    const destDir = createTempDir("freeanima-dl-progress-");
    tempDirs.push(destDir);
    const dest = join(destDir, "asset.bin");
    const body = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const progress: Array<{ received: number; total: number | null }> = [];
    await downloadReleaseAsset("https://example.com/asset.bin", dest, {
      fetchImpl: (async () =>
        new Response(body, {
          status: 200,
          headers: { "content-length": String(body.byteLength) },
        })) as unknown as typeof fetch,
      onProgress: (p) => progress.push(p),
    });
    expect(readFileSync(dest)).toEqual(Buffer.from(body));
    expect(progress.at(-1)).toEqual({ received: body.byteLength, total: body.byteLength });
  });

  it("reports null total when Content-Length is absent", async () => {
    const { downloadReleaseAsset } = await import("./download.ts");
    const destDir = createTempDir("freeanima-dl-progress-nolength-");
    tempDirs.push(destDir);
    const dest = join(destDir, "asset.bin");
    const body = new Uint8Array([9, 8, 7, 6]);
    const progress: Array<{ received: number; total: number | null }> = [];
    await downloadReleaseAsset("https://example.com/asset.bin", dest, {
      fetchImpl: (async () =>
        new Response(body, {
          status: 200,
        })) as unknown as typeof fetch,
      onProgress: (p) => progress.push(p),
    });
    expect(readFileSync(dest)).toEqual(Buffer.from(body));
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toEqual({ received: body.byteLength, total: null });
  });
});
