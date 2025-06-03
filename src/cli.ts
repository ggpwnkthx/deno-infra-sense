// src/cli.ts

import { parseArgs } from "jsr:@std/cli";
import { parse as parseJsonc } from "jsr:@std/jsonc";
import { getDefaultLogger, setupLogger } from "./logger.ts";
import detect from "./mod.ts";

interface ProjectInfo {
  /**
   * Project name, typically defined in deno.jsonc.
   */
  name: string;
  /**
   * Project version, typically defined in deno.jsonc.
   */
  version: string;
}

/**
 * Reads "deno.jsonc" from the project root and extracts "name" and "version" fields.
 * If the file cannot be read or fields are missing, returns defaults.
 *
 * @returns Promise resolving to a ProjectInfo object:
 *          - `name`: string or "unknown" if missing.
 *          - `version`: string or "0.0.0" if missing.
 */
async function getProjectInfo(): Promise<ProjectInfo> {
  try {
    const raw = await Deno.readTextFile("deno.jsonc");
    const data = parseJsonc(raw) as Record<string, unknown>;
    const nameField = typeof data.name === "string" ? data.name : "unknown";
    const versionField = typeof data.version === "string"
      ? data.version
      : "0.0.0";
    return { name: nameField, version: versionField };
  } catch {
    // File not found or parsing error: use defaults
    return { name: "unknown", version: "0.0.0" };
  }
}

/**
 * Main entrypoint for the CLI. Parses command-line arguments, sets up logging based on flags,
 * invokes container detection logic, and exits with an appropriate status code.
 *
 * @param args - Array of command-line arguments (e.g., Deno.args).
 * @returns Promise resolving when the CLI has finished execution.
 */
async function main(args: string[]): Promise<void> {
  // Retrieve project metadata (name & version) for CLI usage/version display
  const { name, version } = await getProjectInfo();

  // Parse CLI flags: --help, --json, --verbose, --version
  const parsed = parseArgs(args, {
    boolean: ["help", "json", "verbose", "version"],
    default: { help: false, json: false, verbose: false, version: false },
  });

  // Handle --help: print usage and exit
  if (parsed.help) {
    console.log(
      `Usage: deno run --allow-all src/cli.ts [options]

Options:
  --verbose           Show debug messages.
  --json              Output logs in JSON instead of plain text.
  --version           Show version and exit.
  --help              Show this help message.`,
    );
    Deno.exit(0);
  }

  // Handle --version: print project name and version and exit
  if (parsed.version) {
    console.log(`${name}@${version}`);
    Deno.exit(0);
  }

  // Reject any unknown positional arguments
  if (parsed._.length > 0) {
    console.error("Unknown argument(s):", parsed._);
    Deno.exit(1);
  }

  // Determine desired logging level and format based on flags:
  //  - If --verbose is true, level = "DEBUG"; otherwise "INFO".
  //  - If --json is true, format = JSON; otherwise plain text.
  const desiredLevel = parsed.verbose ? "DEBUG" : "INFO";
  const wantJsonFormat = parsed.json;

  // Initialize the global logger. This must be done before calling getDefaultLogger().
  setupLogger({
    level: desiredLevel,
    jsonFormat: wantJsonFormat,
    // If file logging is desired, set filePath here (requires --allow-write).
    // e.g., filePath: "./container.log"
  });

  // Retrieve the configured logger instance. Throws if setupLogger() was not called.
  const logger = getDefaultLogger();

  try {
    // Perform container detection with the logger
    const platform = await detect(logger);
    // Log a structured info event indicating detection has completed
    logger.info(platform);
    Deno.exit(0);
  } catch (error) {
    // Log any error that occurred during detection and exit with failure code
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Detection failed: ${message}`);
    Deno.exit(1);
  }
}

// If this module is run directly (not imported), invoke main with Deno.args
if (import.meta.main) {
  main(Deno.args);
}
