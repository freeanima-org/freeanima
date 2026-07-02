import { describe, it, expect } from "bun:test";
import { buildProgram } from "./program.ts";
import { generateCompletion, SUPPORTED_SHELLS } from "./completion/generate.ts";

describe("shell completion", () => {
  it("supported shells", () => {
    expect(SUPPORTED_SHELLS).toEqual(["bash", "zsh"]);
  });

  it.each([...SUPPORTED_SHELLS])("generate %s smoke", (shell: string) => {
    const program = buildProgram();
    const script = generateCompletion(shell, program);
    expect(script.length).toBeGreaterThan(50);
  });

  it("bash registers complete", () => {
    const script = generateCompletion("bash", buildProgram());
    expect(script).toContain("complete -F _anima anima");
  });

  it("zsh has compdef", () => {
    const script = generateCompletion("zsh", buildProgram());
    expect(script).toContain("#compdef anima");
  });

  it("covers top-level commands", () => {
    const bash = generateCompletion("bash", buildProgram());
    const zsh = generateCompletion("zsh", buildProgram());
    for (const token of ["service", "vault", "completion", "upgrade"]) {
      expect(bash).toContain(token);
      expect(zsh).toContain(token);
    }
  });

  it("includes service actions and flags", () => {
    const bash = generateCompletion("bash", buildProgram());
    for (const token of ["start", "stop", "restart", "status", "--foreground"]) {
      expect(bash).toContain(token);
    }
    // action at COMP_CWORD===2 (anima service <TAB>)
    expect(bash).toMatch(/_service\(\)[\s\S]*COMP_CWORD === 2/);
  });

  it("includes vault subcommands", () => {
    const bash = generateCompletion("bash", buildProgram());
    for (const token of ["list", "get"]) {
      expect(bash).toContain(token);
    }
  });
});
