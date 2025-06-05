// src/mod.ts

import type { Logger } from "./types.ts";
import detectContainerPlatform from "./detection/mod.ts";
import type { ContainerPlatform } from "./detection/types.ts";

/**
 * Main exported function. Wraps container‐platform detection
 * with optional logging. Returns a ContainerPlatform object
 * (structured as { type, runtime, displayName }).
 *
 * @param logger - Optional Logger (defaults to console if omitted).
 * @returns Promise resolving to a ContainerPlatform interface.
 * @throws Re‐throws any error, after logging.
 */
export default async function detect(
  logger: Logger = console,
): Promise<ContainerPlatform> {
  logger.debug("Starting container platform detection...");

  try {
    const platform = await detectContainerPlatform(logger);
    return platform;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error while detecting container platform: ${message}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    // Rethrow so that callers (e.g. CLI) can handle exit codes, etc.
    throw error;
  }
}

export { detect };
export type { ContainerPlatform };
