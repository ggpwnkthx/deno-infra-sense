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
import type { Logger } from "jsr:@std/log";
import { getDefaultLogger } from "../logger.ts";

/**
 * Enum representing all possible container platforms or the host environment.
 */
export enum ContainerPlatform {
  KubernetesCriO = "Kubernetes (CRI-O)",
  KubernetesDocker = "Kubernetes (Docker)",
  KubernetesOther = "Kubernetes (other)",
  Docker = "Docker",
  Podman = "Podman",
  CRIO = "CRI-O",
  DockerCgroup = "Docker (via cgroup)",
  Containerd = "containerd",
  Rkt = "rkt",
  LXCLXD = "LXC/LXD",
  SystemdNspawn = "systemd-nspawn",
  Host = "Host (no recognized container)",
}

/**
 * Type representing a detection strategy: a human-readable label and an async
 * function that returns `true` if the platform is detected, or `false` otherwise.
 */
type Detector = {
  /**
   * Label to identify the container platform if detection succeeds.
   */
  label: ContainerPlatform;
  /**
   * Async function that attempts to detect the platform. It receives a Logger
   * and returns a Promise that resolves to `true` if detection succeeds, `false` otherwise.
   */
  fn: (logger: Logger) => boolean | Promise<boolean>;
};

/**
 * Safely executes a detector function. Any thrown error is caught, logged as an error,
 * and treated as a non-detection (returns false).
 *
 * @param fn - Detector function accepting a Logger and returning Promise<boolean>.
 * @param label - Label of the detector, used for logging context.
 * @param logger - Logger instance used to record debug/error messages.
 * @returns A Promise that resolves to `true` if detection succeeded, or `false` if not or on error.
 */
async function safeDetect(
  fn: (logger: Logger) => boolean | Promise<boolean>,
  label: string,
  logger: Logger,
): Promise<boolean> {
  try {
    const detected = await fn(logger);
    logger.debug(`Detector [${label}] → ${detected}`);
    return detected;
  } catch (error) {
    // Log the error but suppress it to avoid failing the entire detection process.
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Detector error suppressed [${label}]: ${message}`);
    return false;
  }
}

/**
 * Attempts to determine which container runtime is used within a Kubernetes pod.
 * Priority:
 *   1. CRI-O
 *   2. Docker via cgroup
 *   3. Fallback to "other" if neither CRI-O nor Docker is detected
 *
 * @param logger - Logger instance for debug/error output.
 * @returns A Promise resolving to the specific `ContainerPlatform` value for Kubernetes.
 */
async function detectKubernetesPlatform(
  logger: Logger,
): Promise<ContainerPlatform> {
  // Check CRI-O first
  if (await safeDetect(detectCrio, ContainerPlatform.KubernetesCriO, logger)) {
    return ContainerPlatform.KubernetesCriO;
  }

  // If not CRI-O, check Docker via cgroup
  if (
    await safeDetect(
      detectDockerCgroup,
      ContainerPlatform.KubernetesDocker,
      logger,
    )
  ) {
    return ContainerPlatform.KubernetesDocker;
  }

  // Neither CRI-O nor Docker detected; mark as "other" Kubernetes runtime
  logger.debug("Kubernetes runtime detected as 'other'");
  return ContainerPlatform.KubernetesOther;
}

/**
 * Ordered list of detectors to run when not in Kubernetes. Each detector checks
 * for a specific container platform. The order indicates priority: first match wins.
 */
const standaloneDetectors: Detector[] = [
  { label: ContainerPlatform.Docker, fn: detectDockerEnv },
  { label: ContainerPlatform.Podman, fn: detectPodman },
  { label: ContainerPlatform.CRIO, fn: detectCrio },
  { label: ContainerPlatform.DockerCgroup, fn: detectDockerCgroup },
  { label: ContainerPlatform.Containerd, fn: detectContainerd },
  { label: ContainerPlatform.Rkt, fn: detectRkt },
  { label: ContainerPlatform.LXCLXD, fn: detectLXC },
  { label: ContainerPlatform.SystemdNspawn, fn: detectSystemdNspawn },
];

/**
 * Internal cache holding the last detected platform and the timestamp of detection.
 * Used to avoid redundant checks within a short time window.
 */
let _cachedResult: { platform: ContainerPlatform; timestamp: number } | null =
  null;

/**
 * Maximum age (in milliseconds) of the cached detection result before it is considered stale.
 * Default: 30 seconds.
 */
const CACHE_TTL_MS = 30_000;

/**
 * Clears the cached detection result, forcing the next call to `detectContainerPlatform`
 * to rerun all detection logic.
 */
export function resetCachedPlatform(): void {
  _cachedResult = null;
}

/**
 * Detects the current container platform (or host) in which this process is running.
 * Uses a cache to avoid re-running expensive checks on each invocation. The detection logic is:
 *
 * 1. If cache is valid (not older than CACHE_TTL_MS and forceRefresh is false), return cached result.
 * 2. Check if running inside Kubernetes:
 *    - If true, call `detectKubernetesPlatform` to distinguish CRI-O, Docker, or other.
 * 3. If not in Kubernetes, run each detector in `standaloneDetectors` in order; return first match.
 * 4. If no match, assume Host.
 *
 * @param logger - Optional Logger instance; if not provided, the default logger from `getDefaultLogger()` is used.
 * @param options - Optional configuration.
 *   - `forceRefresh` (boolean): if true, ignore cache and rerun all detection steps.
 * @returns A Promise resolving to the detected `ContainerPlatform` value.
 */
export async function detectContainerPlatform(
  logger?: Logger,
  options?: { forceRefresh?: boolean },
): Promise<ContainerPlatform> {
  // Use provided logger or fallback to default
  const actualLogger = logger ?? getDefaultLogger();
  const now = Date.now();

  // Return cached result if still valid and not force-refreshing
  if (
    !options?.forceRefresh &&
    _cachedResult !== null &&
    now - _cachedResult.timestamp <= CACHE_TTL_MS
  ) {
    actualLogger.debug(
      `Returning cached platform: ${_cachedResult.platform}`,
    );
    return _cachedResult.platform;
  }

  // 1. Check for Kubernetes environment
  if (await safeDetect(detectKubernetes, "Kubernetes", actualLogger)) {
    actualLogger.debug("Inside Kubernetes environment");
    const platform = await detectKubernetesPlatform(actualLogger);
    actualLogger.debug(`Detected Kubernetes platform: ${platform}`);
    // Cache result
    _cachedResult = { platform, timestamp: now };
    return platform;
  }

  // 2. Not in Kubernetes: run each standalone detector in priority order
  for (const { label, fn } of standaloneDetectors) {
    if (await safeDetect(fn, label, actualLogger)) {
      actualLogger.debug(`Detected container platform: ${label}`);
      _cachedResult = { platform: label, timestamp: now };
      return label;
    }
  }

  // 3. No container detected: default to Host
  const hostPlatform = ContainerPlatform.Host;
  _cachedResult = { platform: hostPlatform, timestamp: now };
  actualLogger.debug(
    "No container detected; defaulting to host environment",
  );
  return hostPlatform;
}

export default detectContainerPlatform;
