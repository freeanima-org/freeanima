import { describe, expect, test } from "bun:test";
import { boneNameToZone } from "./VrmBodyPicker.ts";

describe("boneNameToZone", () => {
  test("maps head and neck to head", () => {
    expect(boneNameToZone("head")).toBe("head");
    expect(boneNameToZone("neck")).toBe("head");
  });

  test("maps torso bones", () => {
    expect(boneNameToZone("chest")).toBe("torso");
    expect(boneNameToZone("spine")).toBe("torso");
  });

  test("maps arm sides", () => {
    expect(boneNameToZone("leftUpperArm")).toBe("leftArm");
    expect(boneNameToZone("rightHand")).toBe("rightArm");
  });

  test("maps leg sides", () => {
    expect(boneNameToZone("leftFoot")).toBe("leftLeg");
    expect(boneNameToZone("rightUpperLeg")).toBe("rightLeg");
  });

  test("returns null for unknown bone", () => {
    expect(boneNameToZone("unknown")).toBeNull();
  });
});
