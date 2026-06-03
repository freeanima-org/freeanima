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

  with(scope: LogScope): Logger;
  with(attributes: LogAttributes): Logger;
}

export type CreateLoggerOptions = {
  level?: LogLevel;
  base?: LogAttributes;
  sinks: LogSink[];
};
