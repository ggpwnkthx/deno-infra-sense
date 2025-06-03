// src/logger.ts

import * as log from "jsr:@std/log@0.224.14";

/** Re-export the Logger type from @std/log for convenience. */
export type Logger = log.Logger;

/**
 * Options for configuring the logger.
 */
export interface LoggerOptions {
  /**
   * Minimum log level (e.g., "DEBUG", "INFO", "WARNING", "ERROR").
   * Defaults to environment variable LOG_LEVEL or "INFO".
   */
  level?: log.LevelName;
  /**
   * Whether to format console logs as JSON. Defaults to environment variable
   * LOG_JSON === "true" or false.
   */
  jsonFormat?: boolean;
  /**
   * Optional file path to write logs to. If specified, a FileHandler is added.
   * Requires --allow-write permission at runtime.
   */
  filePath?: string;
  /**
   * Name of the logger to configure. Defaults to "container-detector".
   */
  loggerName?: string;
}

/**
 * Creates a ConsoleHandler for @std/log with either JSON or text formatting.
 *
 * @param level - Minimum log level threshold for console output.
 * @param useJson - If true, use JSON formatting; otherwise use a custom text formatter.
 * @returns A configured ConsoleHandler instance.
 */
function createConsoleHandler(
  level: log.LevelName,
  useJson: boolean,
): log.ConsoleHandler {
  const formatter: log.FormatterFunction = useJson
    ? log.formatters.jsonFormatter
    : (record: log.LogRecord) => {
      // ISO 8601 timestamp + log level + logger name + message (stringified if necessary)
      const ts = new Date(record.datetime).toISOString();
      const msg = typeof record.msg === "string"
        ? record.msg
        : JSON.stringify(record.msg);
      return `[${ts}] ${record.levelName} ${record.loggerName}: ${msg}`;
    };

  return new log.ConsoleHandler(level, {
    formatter,
    useColors: !useJson,
  });
}

/**
 * Creates a FileHandler for @std/log that writes to `filePath` using a simple
 * timestamped text format.
 *
 * @param level - Minimum log level threshold for file output.
 * @param filePath - Filesystem path to the log file.
 * @returns A configured FileHandler instance.
 */
function createFileHandler(
  level: log.LevelName,
  filePath: string,
): log.FileHandler {
  return new log.FileHandler(level, {
    filename: filePath,
    formatter: (record: log.LogRecord) => {
      // ISO 8601 timestamp + log level + logger name + message
      const ts = new Date(record.datetime).toISOString();
      const msg = typeof record.msg === "string"
        ? record.msg
        : JSON.stringify(record.msg);
      return `${ts} ${record.levelName} ${record.loggerName} ${msg}`;
    },
  });
}

/**
 * Configures and sets up logging for the application using @std/log.
 * Must be called before any calls to `getDefaultLogger()`.
 *
 * @param opts - Configuration options:
 *   - level: Overrides LOG_LEVEL env var; default "INFO".
 *   - jsonFormat: Overrides LOG_JSON env var; default false.
 *   - filePath: If provided, logs also go to that file.
 *   - loggerName: Name of the logger to configure (default "container-detector").
 */
export function setupLogger(opts: LoggerOptions = {}): void {
  // 1. Determine log level: opts.level takes precedence, then LOG_LEVEL env var, then "INFO"
  const envLevel = Deno.env.get("LOG_LEVEL") as log.LevelName | undefined;
  const level: log.LevelName = opts.level ?? envLevel ?? "INFO";

  // 2. Determine if JSON formatting should be used: opts.jsonFormat takes precedence, then LOG_JSON === "true"
  const envJson = Deno.env.get("LOG_JSON") === "true";
  const useJson = opts.jsonFormat ?? envJson;

  // 3. Build handler map (name → BaseHandler)
  const handlers: Record<string, log.BaseHandler> = {
    console: createConsoleHandler(level, useJson),
  };

  // If a file path is provided (either via opts or LOG_FILE env var), add a FileHandler
  const fileTarget = opts.filePath ?? Deno.env.get("LOG_FILE") ?? undefined;
  if (fileTarget) {
    handlers["file"] = createFileHandler(level, fileTarget);
  }

  // 4. Configure loggers: the named logger and the default logger route to all handlers
  const loggerName = opts.loggerName ?? "container-detector";
  const handlerNames = Object.keys(handlers);

  log.setup({
    handlers,
    loggers: {
      [loggerName]: {
        level,
        handlers: handlerNames,
      },
      default: {
        level,
        handlers: handlerNames,
      },
    },
  });
}

/**
 * Retrieves the logger instance for the given name (default "container-detector").
 * Throws an error if `setupLogger()` has not been called yet (no handlers attached).
 *
 * @param name - Name of the logger to retrieve.
 * @returns Logger instance.
 * @throws If the logger has not been initialized via `setupLogger()`.
 */
export function getDefaultLogger(
  name: string = "container-detector",
): Logger {
  const logger = log.getLogger(name);
  if (logger.handlers.length === 0) {
    setupLogger();
  }
  return logger;
}

// Re‐export the entire `log` namespace for convenience and lower-level access.
export { log };
