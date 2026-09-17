import { beforeEach, describe, expect, test } from "bun:test";
import { onCharacterModelSwitch, useCharacterStore } from "./character.ts";
import { useCompanionStore } from "./companion.ts";

describe("onCharacterModelSwitch", () => {
  beforeEach(() => {
    useCharacterStore.setState({ patrolling: false });
    useCompanionStore.setState({ characterReady: true, modelLoading: false });
  });

  test("退出巡逻并保持可再切模", () => {
    useCharacterStore.setState({ patrolling: true });
    onCharacterModelSwitch();
    expect(useCharacterStore.getState().patrolling).toBe(false);
  });
});
