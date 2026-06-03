import { describe, it, expect } from "bun:test";
import { buildProgram } from "../../../../apps/cli/src/program";
import { generateCompletion, SUPPORTED_SHELLS } from "../../../../apps/cli/src/completion/generate";

describe("shell completion", () => {
  it("supported shells", () => {
    expect(SUPPORTED_SHELLS).toEqual(["bash", "zsh"]);
  });

  it.each(SUPPORTED_SHELLS)("generate %s smoke", (shell) => {
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
    for (const token of ["service", "credential", "completion"]) {
      expect(bash).toContain(token);
      expect(zsh).toContain(token);
    }
  });

  it("includes service actions and flags", () => {
    const bash = generateCompletion("bash", buildProgram());
    for (const token of ["start", "stop", "restart", "status", "--foreground"]) {
      expect(bash).toContain(token);
    }
    // action 在 COMP_CWORD==2（anima service <TAB>）
    expect(bash).toMatch(/_service\(\)[\s\S]*COMP_CWORD == 2/);
  });

  it("includes credential subcommands", () => {
    const bash = generateCompletion("bash", buildProgram());
    for (const token of ["list", "get", "add"]) {
      expect(bash).toContain(token);
    }
  });
});
