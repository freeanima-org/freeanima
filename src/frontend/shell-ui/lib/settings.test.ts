import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { defineSettingsForm, listSettingsSectionsForPlatform } from "./settings.ts";
import type { SettingsBinding } from "./settings.ts";

describe("defineSettingsForm", () => {
  test("accepts matching keys", () => {
    const fields = defineSettingsForm({
      zodSchema: z.object({ hubUrl: z.string(), remoteAuthToken: z.string() }),
      items: [
        { key: "hubUrl", type: "text", label: "Hub" },
        { key: "remoteAuthToken", type: "password", label: "Token" },
      ],
    });
    expect(fields.items).toHaveLength(2);
  });

  test("rejects orphan field keys", () => {
    expect(() =>
      defineSettingsForm({
        zodSchema: z.object({ hubUrl: z.string() }),
        items: [{ key: "missing", type: "text", label: "X" }],
      }),
    ).toThrow(/不在 zodSchema/);
  });
});

describe("listSettingsSectionsForPlatform", () => {
  const bindings: SettingsBinding[] = [
    {
      section: {
        id: "hub",
        order: 0,
        title: "Hub",
        platforms: {
          desktop: {
            kind: "form",
            fields: {
              zodSchema: z.object({ hubUrl: z.string() }),
              items: [{ key: "hubUrl", type: "text", label: "Hub" }],
            },
          },
        },
      },
    },
    {
      section: {
        id: "companion",
        order: 10,
        title: "Companion",
        platforms: {
          desktop: { kind: "component", load: async () => ({ default: () => null }) },
        },
      },
    },
  ];

  test("filters by platform", () => {
    const desktop = listSettingsSectionsForPlatform(bindings, "desktop");
    expect(desktop).toHaveLength(2);
    const mobile = listSettingsSectionsForPlatform(bindings, "mobile");
    expect(mobile).toHaveLength(0);
  });

  test("sorts by order", () => {
    const rows = listSettingsSectionsForPlatform(bindings, "desktop");
    expect(rows[0]?.section.id).toBe("hub");
    expect(rows[1]?.section.id).toBe("companion");
  });
});
