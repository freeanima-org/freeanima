/** Minimal oxlint / ESLint rule context used by FreeAnima custom rules. */
export type RuleContext = {
  filename: string;
  sourceCode: {
    text: string;
    getText: (node?: unknown) => string;
  };
  report: (descriptor: { message: string; node: unknown }) => void;
};

export type RuleModule = {
  meta?: {
    type?: "problem" | "suggestion" | "layout";
    docs?: { description?: string };
    schema?: unknown[];
  };
  create: (context: RuleContext) => {
    [selector: string]: ((node: unknown) => void) | undefined;
  };
};
