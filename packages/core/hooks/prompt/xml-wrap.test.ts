import { describe, expect, it } from "bun:test";

import {
  PROMPT_XML_TAGS,
  truncatePromptBodyForXmlBudget,
  wrapPromptXml,
  wrapPromptXmlSection,
} from "./xml-wrap.ts";

describe("wrapPromptXml", () => {
  it("wraps body with open/close tags", () => {
    expect(wrapPromptXml(PROMPT_XML_TAGS.passiveMemory, "- a\n- b")).toBe(
      "<passive_memory>\n- a\n- b\n</passive_memory>",
    );
  });

  it("returns empty for blank body", () => {
    expect(wrapPromptXml("x", "")).toBe("");
    expect(wrapPromptXml("x", "  \n  ")).toBe("");
  });

  it("formats attrs and escapes quotes in values", () => {
    expect(wrapPromptXml(PROMPT_XML_TAGS.skill, "body", { attrs: { name: 'a"b' } })).toBe(
      '<skill name="a&quot;b">\nbody\n</skill>',
    );
  });

  it("supports inline single-line tags", () => {
    expect(wrapPromptXml(PROMPT_XML_TAGS.time, "2026-05-20T08:02 周三", { inline: true })).toBe(
      "<time>2026-05-20T08:02 周三</time>",
    );
  });
});

describe("truncatePromptBodyForXmlBudget", () => {
  it("truncates body before wrap so closing tag survives", () => {
    const { body, truncated } = truncatePromptBodyForXmlBudget("BODY".repeat(50), 60, {
      tag: "env_health",
      frame: "Frame text.",
    });
    expect(truncated).toBe(true);
    const rendered = wrapPromptXmlSection("env_health", body, { frame: "Frame text." });
    expect(rendered).toContain("</env_health>");
    expect(rendered.length).toBeLessThanOrEqual(60);
  });
});

describe("wrapPromptXmlSection", () => {
  it("puts frame outside the tag", () => {
    expect(
      wrapPromptXmlSection(PROMPT_XML_TAGS.residentMemory, "- fact", {
        frame: "Below is your resident memory.",
      }),
    ).toBe("Below is your resident memory.\n\n<resident_memory>\n- fact\n</resident_memory>");
  });
});
