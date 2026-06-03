import { shouldLog } from "./levels.js";
import { hasComponent, mergeAttributes } from "./merge-attributes.js";
import type {
  CreateLoggerOptions,
  LogAttributes,
  LogLevel,
  LogRecord,
  LogScope,
  LogSink,
  Logger,
} from "./types.js";

function emitToSinks(sinks: LogSink[], record: LogRecord): void {
  for (const sink of sinks) {
    try {
      sink.emit(record);
    } catch {
      /* sink 失败不得影响主流程 */
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
    this.base = { ...(options.base ?? {}) };
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
      throw new Error("logger.with() 需要 component（首次建立 scope 时必填）");
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
