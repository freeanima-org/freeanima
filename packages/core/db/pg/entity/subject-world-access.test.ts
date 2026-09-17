import { describe, expect, it } from "bun:test";

import { accessLevelMeets, subjectWorldAccessLevel } from "./subject-world-access.ts";

describe("subjectWorldAccessLevel", () => {
  it("gives owner write on private world", () => {
    expect(subjectWorldAccessLevel({ private: true, owner_subject_id: 53, grants: [] }, 53)).toBe(
      "write",
    );
  });

  it("denies unrelated subject on private world", () => {
    expect(subjectWorldAccessLevel({ private: true, owner_subject_id: 53, grants: [] }, 109)).toBe(
      "none",
    );
  });

  it("honors read and write grants on private world", () => {
    expect(
      subjectWorldAccessLevel(
        {
          private: true,
          owner_subject_id: 53,
          grants: [{ subject_id: 109, permission: "read" }],
        },
        109,
      ),
    ).toBe("read");
    expect(
      subjectWorldAccessLevel(
        {
          private: true,
          owner_subject_id: 53,
          grants: [{ subject_id: 109, permission: "write" }],
        },
        109,
      ),
    ).toBe("write");
  });

  it("gives all subjects read on public world; write only via grant", () => {
    expect(subjectWorldAccessLevel({ private: false, grants: [] }, 109)).toBe("read");
    expect(
      subjectWorldAccessLevel(
        { private: false, grants: [{ subject_id: 109, permission: "write" }] },
        109,
      ),
    ).toBe("write");
    expect(
      subjectWorldAccessLevel(
        { private: false, grants: [{ subject_id: 1, permission: "write" }] },
        109,
      ),
    ).toBe("read");
  });
});

describe("accessLevelMeets", () => {
  it("maps levels to required access", () => {
    expect(accessLevelMeets("none", "read")).toBe(false);
    expect(accessLevelMeets("read", "read")).toBe(true);
    expect(accessLevelMeets("read", "write")).toBe(false);
    expect(accessLevelMeets("write", "read")).toBe(true);
    expect(accessLevelMeets("write", "write")).toBe(true);
  });
});
