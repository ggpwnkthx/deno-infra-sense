// src/logger.ts

export interface Logger {
  log: (msg: string | Record<string, unknown>) => void;
  debug: (msg: string | Record<string, unknown>) => void;
  warn: (msg: string | Record<string, unknown>) => void;
  error: (msg: string | Record<string, unknown>) => void;
}
