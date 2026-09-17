import { describe, expect, it } from "bun:test";

import {
  disambiguateSpeakerLabels,
  shortHabitatInstanceId,
  shortPublicId,
  type SpeakerLabelParts,
} from "./room-speaker-label.ts";

describe("short ids", () => {
  it("shortPublicId keeps short ids and tails long ones", () => {
    expect(shortPublicId("abc")).toBe("abc");
    expect(shortPublicId("abcdefghijklmn")).toBe("ijklmn");
  });

  it("shortHabitatInstanceId uses tail", () => {
    expect(shortHabitatInstanceId("fa_inst_hubabc12")).toBe("hubabc12");
  });
});

describe("disambiguateSpeakerLabels", () => {
  it("keeps unique local names unchanged", () => {
    const parts: SpeakerLabelParts[] = [
      { public_id: "pid-a", base_name: "灼华", remote: false },
      { public_id: "pid-b", base_name: "小柔", remote: false },
    ];
    const map = disambiguateSpeakerLabels(parts);
    expect(map.get("pid-a")).toBe("灼华");
    expect(map.get("pid-b")).toBe("小柔");
  });

  it("appends habitat label when titles collide", () => {
    const parts: SpeakerLabelParts[] = [
      {
        public_id: "pid-home",
        base_name: "小草",
        remote: false,
        habitat_label: "本机",
      },
      {
        public_id: "pid-nas",
        base_name: "小草",
        remote: true,
        habitat_instance_id: "fa_inst_nasxxxx",
        habitat_label: "家里 NAS",
      },
    ];
    const map = disambiguateSpeakerLabels(parts);
    expect(map.get("pid-home")).toBe("小草 · 本机");
    expect(map.get("pid-nas")).toBe("小草 · 家里 NAS");
  });

  it("appends habitat / public_id hint for remote even without collision", () => {
    const parts: SpeakerLabelParts[] = [
      { public_id: "pid-local", base_name: "灼华", remote: false },
      {
        public_id: "pid-remote",
        base_name: "小柔",
        remote: true,
        habitat_instance_id: "fa_inst_abcdef12",
      },
    ];
    const map = disambiguateSpeakerLabels(parts);
    expect(map.get("pid-local")).toBe("灼华");
    expect(map.get("pid-remote")).toBe("小柔 · abcdef12");
  });

  it("falls back to short public_id when no habitat hint", () => {
    const parts: SpeakerLabelParts[] = [
      { public_id: "pid-aaaaaaaaaaaa", base_name: "同名", remote: false },
      { public_id: "pid-bbbbbbbbbbbb", base_name: "同名", remote: true },
    ];
    const map = disambiguateSpeakerLabels(parts);
    expect(map.get("pid-aaaaaaaaaaaa")).toBe("同名 · aaaaaa");
    expect(map.get("pid-bbbbbbbbbbbb")).toBe("同名 · bbbbbb");
  });
});
