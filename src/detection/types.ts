// src/detection/types.ts

/**
 * A high‐level categorization of how a container might be orchestrated or run.
 */
export enum PlatformType {
  Kubernetes = "kubernetes",
  Standalone = "standalone",
  Host = "host",
}

/**
 * The specific container runtime implementation.
 */
export enum Runtime {
  Docker = "docker",
  Crio = "crio",
  Containerd = "containerd",
  Podman = "podman",
  Rkt = "rkt",
  LXC = "lxc",
  SystemdNspawn = "systemd-nspawn",
  Other = "other",
  None = "none", // used for Host or unknown
}

/**
 * A fully‐rich representation of any detected platform.
 */
export interface ContainerPlatform {
  /**
   * Whether this is under Kubernetes orchestration, stand‐alone container runtime, or pure host.
   */
  type: PlatformType;
  /**
   * The specific runtime name (docker, crio, containerd, etc.).
   * If type === Host, runtime should be Runtime.None
   */
  runtime: Runtime;
  /**
   * A human‐friendly display string (e.g. "Kubernetes (CRI-O)").
   */
  displayName: string;
}

/**
 * All possible container platforms (including “host”).
 * Each key corresponds to a fully‐populated ContainerPlatform object.
 */
export const ContainerPlatforms = {
  KubernetesCriO: {
    type: PlatformType.Kubernetes,
    runtime: Runtime.Crio,
    displayName: "Kubernetes (CRI-O)",
  },
  KubernetesDocker: {
    type: PlatformType.Kubernetes,
    runtime: Runtime.Docker,
    displayName: "Kubernetes (Docker)",
  },
  KubernetesOther: {
    type: PlatformType.Kubernetes,
    runtime: Runtime.Other,
    displayName: "Kubernetes (other)",
  },
  Docker: {
    type: PlatformType.Standalone,
    runtime: Runtime.Docker,
    displayName: "Docker",
  },
  Podman: {
    type: PlatformType.Standalone,
    runtime: Runtime.Podman,
    displayName: "Podman",
  },
  Crio: {
    type: PlatformType.Standalone,
    runtime: Runtime.Crio,
    displayName: "CRI-O",
  },
  DockerCgroup: {
    type: PlatformType.Standalone,
    runtime: Runtime.Docker,
    displayName: "Docker (via cgroup)",
  },
  Containerd: {
    type: PlatformType.Standalone,
    runtime: Runtime.Containerd,
    displayName: "containerd",
  },
  Rkt: {
    type: PlatformType.Standalone,
    runtime: Runtime.Rkt,
    displayName: "rkt",
  },
  LXCLXD: {
    type: PlatformType.Standalone,
    runtime: Runtime.LXC,
    displayName: "LXC/LXD",
  },
  SystemdNspawn: {
    type: PlatformType.Standalone,
    runtime: Runtime.SystemdNspawn,
    displayName: "systemd-nspawn",
  },
  Host: {
    type: PlatformType.Host,
    runtime: Runtime.None,
    displayName: "Host (no recognized container)",
  },
} as const;

/**
 * A union type of all keys of ContainerPlatforms.
 * We will use this to index into ContainerPlatforms.
 */
export type ContainerPlatformKey = keyof typeof ContainerPlatforms;
