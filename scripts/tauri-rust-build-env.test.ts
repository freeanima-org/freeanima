import { describe, expect, test } from "bun:test";
import { defaultCargoBuildJobs, resolveTauriRustBuildEnv } from "./tauri-rust-build-env.ts";

describe("tauri-rust-build-env", () => {
  test("defaultCargoBuildJobs clamps to [2, 8]", () => {
    expect(defaultCargoBuildJobs(1)).toBe(2);
    expect(defaultCargoBuildJobs(4)).toBe(4);
    expect(defaultCargoBuildJobs(16)).toBe(8);
  });

  test("preserves explicit RUSTC_WRAPPER and CARGO_BUILD_JOBS", () => {
    const env = resolveTauriRustBuildEnv({
      RUSTC_WRAPPER: "custom",
      CARGO_BUILD_JOBS: "3",
      RUSTFLAGS: "-C link-arg=-fuse-ld=mold",
    });
    expect(env.RUSTC_WRAPPER).toBe("custom");
    expect(env.CARGO_BUILD_JOBS).toBe("3");
    expect(env.RUSTFLAGS).toBe("-C link-arg=-fuse-ld=mold");
  });

  test("sets CARGO_BUILD_JOBS when unset", () => {
    const env = resolveTauriRustBuildEnv({}, { defaultJobs: 5 });
    expect(env.CARGO_BUILD_JOBS).toBe("5");
  });
});
