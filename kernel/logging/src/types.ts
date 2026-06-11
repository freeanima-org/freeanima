export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogAttributes = Record<string, unknown>;

export type LogScope = {
  component: string;
} & LogAttributes;

export type LogRecord = {
  readonly level: LogLevel;
  readonly message: string;
  readonly attributes: Readonly<LogAttributes>;
  readonly timestamp: number;
};

export interface LogSink {
  emit(record: LogRecord): void;
}

export interface Logger {
  debug(message: string, attributes?: LogAttributes): void;
  info(message: string, attributes?: LogAttributes): void;
  warn(message: string, attributes?: LogAttributes): void;
  error(message: string, attributes?: LogAttributes): void;

  /** Establish or extend scope; first call must include {@link LogScope.component} */
  with(scope: LogScope): Logger;
  /**
   * Extend scope with attributes when component already established on this logger.
   * @throws when component is not yet set on the logger chain
   */
  with(attributes: LogAttributes): Logger;
}

export type CreateLoggerOptions = {
  level?: LogLevel;
  base?: LogAttributes;
  sinks: LogSink[];
};
