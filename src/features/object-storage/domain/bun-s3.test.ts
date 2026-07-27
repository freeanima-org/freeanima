import { describe, expect, it } from "bun:test";

import { bunS3OptionsFromResolved, normalizeObjectStorageEndpoint } from "./bun-s3.ts";

describe("normalizeObjectStorageEndpoint", () => {
  it("rewrites Aliyun regional root to bucket virtual host", () => {
    expect(
      normalizeObjectStorageEndpoint("https://oss-cn-beijing.aliyuncs.com", "freeanima-dev"),
    ).toBe("https://freeanima-dev.oss-cn-beijing.aliyuncs.com");
  });

  it("rewrites internal regional root", () => {
    expect(
      normalizeObjectStorageEndpoint("https://oss-cn-beijing-internal.aliyuncs.com/", "b"),
    ).toBe("https://b.oss-cn-beijing-internal.aliyuncs.com");
  });

  it("leaves already-bucketed Aliyun host alone", () => {
    expect(
      normalizeObjectStorageEndpoint(
        "https://freeanima-dev.oss-cn-beijing.aliyuncs.com",
        "freeanima-dev",
      ),
    ).toBe("https://freeanima-dev.oss-cn-beijing.aliyuncs.com");
  });

  it("leaves non-Aliyun endpoints alone", () => {
    expect(normalizeObjectStorageEndpoint("https://s3.example.com", "b")).toBe(
      "https://s3.example.com",
    );
  });
});

describe("bunS3OptionsFromResolved", () => {
  const base = {
    endpoint: "https://s3.example.com",
    bucket: "b",
    region: "cn-hangzhou",
    accessKeyId: "ak",
    secretAccessKey: "sk",
  };

  it("默认 virtualHostedStyle（非 path-style）", () => {
    const opts = bunS3OptionsFromResolved({ ...base, forcePathStyle: false });
    expect(opts.virtualHostedStyle).toBe(true);
    expect(opts.endpoint).toBe(base.endpoint);
    expect(opts.bucket).toBe(base.bucket);
  });

  it("force_path_style 时不设 virtualHostedStyle", () => {
    const opts = bunS3OptionsFromResolved({ ...base, forcePathStyle: true });
    expect(opts.virtualHostedStyle).toBeUndefined();
  });

  it("Aliyun regional endpoint is rewritten for Bun", () => {
    const opts = bunS3OptionsFromResolved({
      ...base,
      endpoint: "https://oss-cn-beijing.aliyuncs.com",
      bucket: "freeanima-dev",
      forcePathStyle: false,
    });
    expect(opts.endpoint).toBe("https://freeanima-dev.oss-cn-beijing.aliyuncs.com");
    expect(opts.virtualHostedStyle).toBe(true);
  });
});
