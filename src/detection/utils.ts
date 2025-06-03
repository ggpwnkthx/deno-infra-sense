// src/detection/utils.ts

import { exists } from "jsr:@std/fs";
import type { Logger } from "../logger.ts";

/**
 * Attempts to detect Kubernetes by checking:
 *   1. The environment variable KUBERNETES_SERVICE_HOST
 *   2. The presence of the ServiceAccount directory at /var/run/secrets/kubernetes.io/serviceaccount
 *   3. A DNS lookup for "kubernetes.default.svc"
 *
 * Requires Deno permissions:
 *   --allow-env=KUBERNETES_SERVICE_HOST                         (to read KUBERNETES_SERVICE_HOST)
 *   --allow-read=/var/run/secrets/kubernetes.io/serviceaccount  (to check ServiceAccount path)
 *   --allow-net=kubernetes.default.svc:53                                                 (to resolve in-cluster DNS)
 */
export async function detectKubernetes(logger: Logger): Promise<boolean> {
  // 1. Check KUBERNETES_SERVICE_HOST
  const svcHost = Deno.env.get("KUBERNETES_SERVICE_HOST");
  if (typeof svcHost === "string" && svcHost.length > 0) {
    logger.debug(
      `detectKubernetes → env var KUBERNETES_SERVICE_HOST=${svcHost} → true`,
    );
    return true;
  }

  // 2. Check ServiceAccount directory
  try {
    const saPath = "/var/run/secrets/kubernetes.io/serviceaccount";
    if (await exists(saPath)) {
      logger.debug(
        `detectKubernetes → ServiceAccount directory found at ${saPath}`,
      );
      return true;
    }
  } catch (err) {
    logger.debug(
      `detectKubernetes → error checking ServiceAccount path: ${String(err)}`,
    );
  }

  // 3. DNS lookup for "kubernetes.default.svc"
  try {
    const addrs = await Deno.resolveDns("kubernetes.default.svc", "A");
    if (addrs.length > 0) {
      logger.debug(
        "detectKubernetes → DNS lookup for kubernetes.default.svc succeeded",
      );
      return true;
    }
  } catch (err) {
    logger.debug(
      `detectKubernetes → DNS lookup failed: ${String(err)}`,
    );
  }

  logger.debug("detectKubernetes → not running inside Kubernetes");
  return false;
}

/**
 * Detects Docker by checking for the existence of "/.dockerenv".
 * If the file exists, returns true.
 *
 * Requires Deno permission: --allow-read=/.dockerenv
 */
export async function detectDockerEnv(logger: Logger): Promise<boolean> {
  try {
    const present = await exists("/.dockerenv");
    logger.debug(`detectDockerEnv → /.dockerenv exists → ${present}`);
    return present;
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      logger.debug(
        "detectDockerEnv → permission denied on /.dockerenv; treating as false",
      );
      return false;
    }
    logger.debug(
      `detectDockerEnv → error checking /.dockerenv: ${
        String(error)
      }; treating as false`,
    );
    return false;
  }
}

/**
 * Detects Docker by checking if the "container" environment variable equals "docker".
 *
 * Requires Deno permission: --allow-env=CONTAINER
 */
export function detectDockerCgroup(logger: Logger): boolean {
  const cont = Deno.env.get("container");
  const found = cont === "docker";
  logger.debug(`detectDockerCgroup → env var container=${cont} → ${found}`);
  return found;
}

/**
 * Detects Podman by:
 *   1. Checking if the "container" environment variable equals "podman"
 *   2. Checking for "/run/.containerenv" and seeing if it contains "podman"
 *
 * Requires Deno permissions:
 *   --allow-env=CONTAINER
 *   --allow-read=/run/.containerenv
 */
export async function detectPodman(logger: Logger): Promise<boolean> {
  // 1. Check environment variable
  const contEnv = Deno.env.get("container");
  if (contEnv && contEnv.toLowerCase() === "podman") {
    logger.debug(`detectPodman → env var container="${contEnv}" → true`);
    return true;
  }

  // 2. Check /run/.containerenv for "podman"
  try {
    const containerEnvPath = "/run/.containerenv";
    if (await exists(containerEnvPath)) {
      const contents = await Deno.readTextFile(containerEnvPath);
      if (contents.toLowerCase().includes("podman")) {
        logger.debug(
          `detectPodman → /run/.containerenv contains "podman" → true`,
        );
        return true;
      }
      logger.debug(
        `detectPodman → /run/.containerenv does not contain "podman" → false`,
      );
    } else {
      logger.debug("detectPodman → /run/.containerenv does not exist → false");
    }
  } catch (err) {
    logger.debug(
      `detectPodman → error reading /run/.containerenv: ${String(err)}`,
    );
  }

  return false;
}

/**
 * Detects CRI-O by:
 *   1. Checking if the "container" environment variable equals "crio"
 *   2. Checking for "/run/.containerenv" and seeing if it contains "crio"
 *
 * Requires Deno permissions:
 *   --allow-env=CONTAINER
 *   --allow-read=/run/.containerenv
 */
export async function detectCrio(logger: Logger): Promise<boolean> {
  // 1. Check environment variable
  const contEnv = Deno.env.get("container");
  if (contEnv && contEnv.toLowerCase() === "crio") {
    logger.debug(`detectCrio → env var container="${contEnv}" → true`);
    return true;
  }

  // 2. Check /run/.containerenv for "crio"
  try {
    const containerEnvPath = "/run/.containerenv";
    if (await exists(containerEnvPath)) {
      const contents = await Deno.readTextFile(containerEnvPath);
      if (contents.toLowerCase().includes("crio")) {
        logger.debug(
          `detectCrio → /run/.containerenv contains "crio" → true`,
        );
        return true;
      }
      logger.debug(
        `detectCrio → /run/.containerenv does not contain "crio" → false`,
      );
    } else {
      logger.debug("detectCrio → /run/.containerenv does not exist → false");
    }
  } catch (err) {
    logger.debug(
      `detectCrio → error reading /run/.containerenv: ${String(err)}`,
    );
  }

  return false;
}

/**
 * Detects containerd by checking if the "container" environment variable equals "containerd".
 *
 * Requires Deno permission: --allow-env=CONTAINER
 */
export function detectContainerd(logger: Logger): boolean {
  const contEnv = Deno.env.get("container");
  const found = contEnv === "containerd";
  logger.debug(`detectContainerd → env var container="${contEnv}" → ${found}`);
  return found;
}

/**
 * Detects rkt by checking if the "container" environment variable equals "rkt".
 *
 * Requires Deno permission: --allow-env=CONTAINER
 */
export function detectRkt(logger: Logger): boolean {
  const contEnv = Deno.env.get("container");
  const found = contEnv === "rkt";
  logger.debug(`detectRkt → env var container="${contEnv}" → ${found}`);
  return found;
}

/**
 * Detects LXC/LXD by checking if the "container" environment variable equals "lxc".
 *
 * Requires Deno permission: --allow-env=CONTAINER
 */
export function detectLXC(logger: Logger): boolean {
  const contEnv = Deno.env.get("container");
  const found = contEnv === "lxc";
  logger.debug(`detectLXC → env var container="${contEnv}" → ${found}`);
  return found;
}

/**
 * Detects systemd-nspawn by:
 *   1. Checking if the "container" environment variable equals "systemd-nspawn"
 *   2. Checking for the existence of "/run/systemd/nspawn/in_container"
 *
 * Requires Deno permissions:
 *   --allow-env=CONTAINER
 *   --allow-read=/run/systemd/nspawn/in_container
 */
export async function detectSystemdNspawn(logger: Logger): Promise<boolean> {
  // 1. Check environment variable
  const contEnv = Deno.env.get("container");
  if (contEnv && contEnv.toLowerCase() === "systemd-nspawn") {
    logger.debug(`detectSystemdNspawn → env var container="${contEnv}" → true`);
    return true;
  }

  // 2. Check /run/systemd/nspawn/in_container
  const nspawnPath = "/run/systemd/nspawn/in_container";
  try {
    if (await exists(nspawnPath)) {
      logger.debug(`detectSystemdNspawn → ${nspawnPath} exists → true`);
      return true;
    }
    logger.debug(`detectSystemdNspawn → ${nspawnPath} does not exist → false`);
  } catch (err) {
    logger.debug(
      `detectSystemdNspawn → error checking ${nspawnPath}: ${String(err)}`,
    );
  }

  return false;
}
