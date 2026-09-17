import { shouldLog } from "./levels.ts";
import { hasComponent, mergeAttributes } from "./merge-attributes.ts";
import type {
  CreateLoggerOptions,
  LogAttributes,
  LogLevel,
  LogRecord,
  LogScope,
  LogSink,
  Logger,
} from "./types.ts";

function emitToSinks(sinks: LogSink[], record: LogRecord): void {
  for (const sink of sinks) {
    try {
      sink.emit(record);
    } catch {
      /* sink failure must not affect main flow */
    }
  }
}

export class LoggerImpl implements Logger {
  private readonly configuredLevel: LogLevel;
  private readonly base: LogAttributes;
  private readonly scope: LogAttributes;
  private readonly sinks: LogSink[];

  constructor(
    options: Pick<CreateLoggerOptions, "level" | "base" | "sinks">,
    scope: LogAttributes = {},
  ) {
    this.configuredLevel = options.level ?? "info";
    this.base = { ...options.base };
    this.scope = { ...scope };
    this.sinks = options.sinks;
  }

  debug(message: string, attributes?: LogAttributes): void {
    this.log("debug", message, attributes);
  }

  info(message: string, attributes?: LogAttributes): void {
    this.log("info", message, attributes);
  }

  warn(message: string, attributes?: LogAttributes): void {
    this.log("warn", message, attributes);
  }

  error(message: string, attributes?: LogAttributes): void {
    this.log("error", message, attributes);
  }

  with(scope: LogScope): Logger;
  with(attributes: LogAttributes): Logger;
  with(scope: LogAttributes & { component?: string }): Logger {
    const nextScope = mergeAttributes(this.scope, scope);
    if (!hasComponent(nextScope)) {
      throw new Error("logger.with() requires component (required when first establishing scope)");
    }
    return new LoggerImpl(
      {
        level: this.configuredLevel,
        base: this.base,
        sinks: this.sinks,
      },
      nextScope,
    );
  }

  private log(level: LogLevel, message: string, attributes?: LogAttributes): void {
    if (!shouldLog(this.configuredLevel, level)) return;

    const record: LogRecord = {
      level,
      message,
      attributes: mergeAttributes(this.base, this.scope, attributes),
      timestamp: Date.now(),
    };
    emitToSinks(this.sinks, record);
  }
}
