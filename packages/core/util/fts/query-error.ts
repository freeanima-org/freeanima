export type FtsQueryErrorCode =
  | "empty_query"
  | "trailing_operator"
  | "leading_operator"
  | "consecutive_operators"
  | "unclosed_quote"
  | "invalid_tsquery_structure";

export class FtsQueryError extends Error {
  readonly code: FtsQueryErrorCode;
  readonly hint: string;

  constructor(code: FtsQueryErrorCode, message: string, hint: string) {
    super(message);
    this.name = "FtsQueryError";
    this.code = code;
    this.hint = hint;
  }
}

export function isFtsQueryError(error: unknown): error is FtsQueryError {
  return error instanceof FtsQueryError;
}

/** LLM-readable tool error body for FTS query validation failures. */
export function formatFtsToolError(error: FtsQueryError): string {
  return `${error.message}\n修改建议：${error.hint}`;
}
