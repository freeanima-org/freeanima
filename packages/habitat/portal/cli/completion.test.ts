import { describe, it, expect } from "bun:test";
import { buildProgram } from "./program.ts";
import { generateCompletion, SUPPORTED_SHELLS } from "./completion/generate.ts";

describe("shell completion", () => {
  it("supported shells", () => {
    expect(SUPPORTED_SHELLS).toEqual(["bash", "zsh"]);
  });

  it.each([...SUPPORTED_SHELLS])("generate %s smoke", (shell: string) => {
    const program = buildProgram({ standalone: true });
    const script = generateCompletion(shell, program);
    expect(script.length).toBeGreaterThan(50);
  });

  it("bash registers complete", () => {
    const script = generateCompletion("bash", buildProgram({ standalone: true }));
    expect(script).toContain("complete -F _anima anima");
  });

  it("zsh has compdef", () => {
    const script = generateCompletion("zsh", buildProgram({ standalone: true }));
    expect(script).toContain("#compdef anima");
  });

  it("source CLI omits service", () => {
    const bash = generateCompletion("bash", buildProgram({ standalone: false }));
    expect(bash).not.toContain("_service()");
    for (const token of ["completion", "upgrade", "versions", "token"]) {
      expect(bash).toContain(token);
    }
    expect(bash).not.toContain("vault");
    expect(bash).not.toContain("_web()");
  });

  it("covers top-level commands when standalone", () => {
    const bash = generateCompletion("bash", buildProgram({ standalone: true }));
    const zsh = generateCompletion("zsh", buildProgram({ standalone: true }));
    for (const token of ["service", "completion", "upgrade", "versions", "token"]) {
      expect(bash).toContain(token);
      expect(zsh).toContain(token);
    }
    expect(bash).not.toContain("vault");
    expect(zsh).not.toContain("vault");
  });

  it("includes service actions and flags when standalone", () => {
    const bash = generateCompletion("bash", buildProgram({ standalone: true }));
    for (const token of ["start", "stop", "restart", "status", "--foreground"]) {
      expect(bash).toContain(token);
    }
    // action at COMP_CWORD==2 (anima service <TAB>)
    expect(bash).toMatch(/_service\(\)[\s\S]*COMP_CWORD == 2/);
  });
});
