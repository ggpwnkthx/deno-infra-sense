// src/mod.ts

import { getDefaultLogger, type Logger } from "./logger.ts";
import detectContainerPlatform, {
  type ContainerPlatform,
} from "./detection/mod.ts";

/**
 * Primary exported detection function. Wraps the container platform detection
 * with logging. Does not exit the process; any errors are logged and rethrown.
 *
 * @param logger - Optional Logger instance. If not provided, uses the default logger.
 * @returns Promise resolving to the detected `ContainerPlatform` enum value.
 * @throws Any error encountered during detection is rethrown after logging.
 */
export default async function detect(
  logger?: Logger,
): Promise<ContainerPlatform> {
  const actualLogger = logger ?? getDefaultLogger();
  actualLogger.debug("Starting container platform detection...");

  try {
    const platform = await detectContainerPlatform(actualLogger);
    return platform;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    actualLogger.error(`Error while detecting container platform: ${message}`);
    if (error instanceof Error && error.stack) {
      actualLogger.error(error.stack);
    }
    // Rethrow so the caller (e.g., CLI) can handle process exit
    throw error;
  }
}
