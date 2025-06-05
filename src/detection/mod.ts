// src/detection/mod.ts

import {
  detectContainerd,
  detectCrio,
  detectDockerCgroup,
  detectDockerEnv,
  detectKubernetes,
  detectLXC,
  detectPodman,
  detectRkt,
  detectSystemdNspawn,
} from "../detection/utils.ts";
import type { Logger } from "../logger.ts";
import type { ContainerPlatform, ContainerPlatformKey } from "./types.ts";
import { ContainerPlatforms } from "./types.ts";

/**
 * A detection entry: the key is one of the ContainerPlatform keys,
 * and `fn` is the function that returns true/false if that platform is detected.
 */
type Detector = {
  /**
   * One of the keys in ContainerPlatforms (e.g. "Docker", "KubernetesCriO", etc.)
   */
  labelKey: ContainerPlatformKey;
  /**
   * Async function that attempts to detect the platform. Returns `true` if detected.
   */
  fn: (logger: Logger) => boolean | Promise<boolean>;
};

/**
 * Safely executes a detector function. Any thrown error is caught, logged as an error,
 * and treated as a non-detection (returns false).
 *
 * @param fn - Detector function accepting a Logger and returning Promise<boolean> (or boolean).
 * @param labelKey - Key into ContainerPlatforms, used to fetch the displayName for logging.
 * @param logger - Logger instance used to record debug/error messages.
 * @returns A Promise that resolves to `true` if detection succeeded, `false` otherwise.
 */
async function safeDetect(
  fn: (logger: Logger) => boolean | Promise<boolean>,
  labelKey: ContainerPlatformKey,
  logger: Logger,
): Promise<boolean> {
  const displayName = ContainerPlatforms[labelKey].displayName;
  try {
    const detected = await fn(logger);
    logger.debug(`Detector [${displayName}] → ${detected}`);
    return detected;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Detector error suppressed [${displayName}]: ${message}`,
    );
    return false;
  }
}

/**
 * When inside Kubernetes, distinguish between CRI-O, Docker, or “other”:
 * Priority: CRI-O → Docker via cgroup → fallback = other.
 */
async function detectKubernetesPlatform(
  logger: Logger,
): Promise<ContainerPlatform> {
  // 1. Check CRI-O first
  if (
    await safeDetect(detectCrio, "KubernetesCriO", logger)
  ) {
    return ContainerPlatforms.KubernetesCriO;
  }

  // 2. If not CRI-O, check Docker via cgroup
  if (
    await safeDetect(
      detectDockerCgroup,
      "KubernetesDocker",
      logger,
    )
  ) {
    return ContainerPlatforms.KubernetesDocker;
  }

  // 3. Neither CRI-O nor Docker detected; mark as “other”
  logger.debug("Kubernetes runtime detected as 'other'");
  return ContainerPlatforms.KubernetesOther;
}

/**
 * Ordered detectors for non-Kubernetes (standalone) environments.
 * Each entry’s `labelKey` corresponds to a ContainerPlatforms key.
 * The first one that returns true “wins.”
 */
const standaloneDetectors: Detector[] = [
  { labelKey: "Docker", fn: detectDockerEnv },
  { labelKey: "Podman", fn: detectPodman },
  { labelKey: "Crio", fn: detectCrio },
  { labelKey: "DockerCgroup", fn: detectDockerCgroup },
  { labelKey: "Containerd", fn: detectContainerd },
  { labelKey: "Rkt", fn: detectRkt },
  { labelKey: "LXCLXD", fn: detectLXC },
  { labelKey: "SystemdNspawn", fn: detectSystemdNspawn },
];

/**
 * Internal cache to avoid re-running detection too often.
 */
let _cachedResult:
  | { platform: ContainerPlatform; timestamp: number }
  | null = null;

/** Cache TTL: 30 seconds. */
const CACHE_TTL_MS = 30_000;

/**
 * Clears any cached detection result so that the next `detectContainerPlatform`
 * call does a full re-detection.
 */
export function resetCachedPlatform(): void {
  _cachedResult = null;
}

/**
 * Detects the current container platform (or Host) in which this process is running.
 * Uses the following logic:
 *
 * 1. If cached result is still fresh (and forceRefresh !== true), return it.
 * 2. Check if inside Kubernetes (via detectKubernetes):
 *    - If yes, call detectKubernetesPlatform() to pick CRI-O / Docker / Other.
 * 3. Otherwise, run through `standaloneDetectors` in priority order; return first match.
 * 4. If no match, return Host.
 *
 * @param logger - Optional Logger instance (defaults to console if omitted).
 * @param options.forceRefresh - If true, ignore the cache and re-run everything.
 * @returns A Promise resolving to the detected ContainerPlatform object.
 */
export async function detectContainerPlatform(
  logger: Logger,
  options?: { forceRefresh?: boolean },
): Promise<ContainerPlatform> {
  const now = Date.now();

  // 1. Return cached result if valid
  if (
    !options?.forceRefresh &&
    _cachedResult !== null &&
    now - _cachedResult.timestamp <= CACHE_TTL_MS
  ) {
    logger.debug(
      `Returning cached platform: ${_cachedResult.platform.displayName}`,
    );
    return _cachedResult.platform;
  }

  // 2. Check for Kubernetes first
  if (await safeDetect(detectKubernetes, "KubernetesOther", logger)) {
    logger.debug("Inside Kubernetes environment");
    const platform = await detectKubernetesPlatform(logger);
    logger.debug(
      `Detected Kubernetes platform: ${platform.displayName}`,
    );
    _cachedResult = { platform, timestamp: now };
    return platform;
  }

  // 3. Run standalone detectors in order
  for (const { labelKey, fn } of standaloneDetectors) {
    if (await safeDetect(fn, labelKey, logger)) {
      const platform = ContainerPlatforms[labelKey];
      logger.debug(`Detected container platform: ${platform.displayName}`);
      _cachedResult = { platform, timestamp: now };
      return platform;
    }
  }

  // 4. Fallback to Host
  const hostPlatform = ContainerPlatforms.Host;
  _cachedResult = { platform: hostPlatform, timestamp: now };
  logger.debug(
    "No container detected; defaulting to host environment",
  );
  return hostPlatform;
}

export default detectContainerPlatform;
