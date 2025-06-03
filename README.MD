# @ggpwnkthx/deno-infra-sense

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [Permissions](#permissions)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Project Structure](#project-structure)
7. [Usage](#usage)
   - [As a Library](#as-a-library)
   - [Command-Line Interface (CLI)](#command-line-interface-cli)
8. [API Reference](#api-reference)
   - [detect](#detect)
   - [detectContainerPlatform](#detectcontainerplatform)
   - [ContainerPlatform Enum](#containerplatform-enum)
   - [resetCachedPlatform](#resetcachedplatform)
   - [resetCgroupCache](#resetcgroupcache)
9. [Detection Logic](#detection-logic)
10. [Development](#development)
11. [Contributing](#contributing)
12. [License](#license)

## Introduction

`@ggpwnkthx/infra-sense` is a lightweight Deno library and CLI tool designed to
detect the container platform or host environment in which a Deno process is
running. It supports a variety of container runtimes, including Docker, Podman,
CRI-O, containerd, Rkt, LXC/LXD, systemd-nspawn, and Kubernetes.

This project aims to provide a simple API and a CLI interface for reliably
determining the current container context, using environment-based detection
strategies and caching to minimize overhead.

## Features

- **Environment-Based Detection:** Checks environment variables, service account
  files, and in-cluster DNS to identify Kubernetes, and container-specific
  markers for other runtimes.
- **Caching:** Results are cached for 30 seconds to avoid redundant checks.
- **Safe Detection:** Errors during detection are caught and logged without
  breaking the detection flow.
- **Flexible Logging:** Integrates with `@std/log` to offer JSON or
  text-formatted logging, with optional file handling.
- **CLI and Library Modes:** Can be used as a standalone CLI or imported as a
  library in other Deno projects.

## Permissions

This project has been refactored to require only the minimal permissions:

- `--allow-env`\
  To read environment variables such as `KUBERNETES_SERVICE_HOST` and
  `container`.
- `--allow-net`\
  To perform DNS lookups for `kubernetes.default.svc`.
- `--allow-read=./deno.jsonc,/var/run/secrets/kubernetes.io/serviceaccount,/.dockerenv`\
  To read:
  - `deno.jsonc` for CLI version and name.
  - `/var/run/secrets/kubernetes.io/serviceaccount` to detect the Kubernetes
    ServiceAccount mount.
  - `/.dockerenv` to detect Docker runtime.

Example CLI invocation:

```bash
deno run --allow-env --allow-net --allow-read=./deno.jsonc,/var/run/secrets/kubernetes.io/serviceaccount,/.dockerenv src/cli.ts
```

## Prerequisites

- **Deno** 2.0 or higher.
- Permissions as listed above to allow environment, read, and network
  operations.

## Installation

To use the library in your Deno project, import the module directly from this
repository:

```ts
import detect from "jsr:@ggpwnkthx/infra-sense";
```

Alternatively, clone the repository and run locally:

```bash
git clone https://github.com/ggpwnkthx/deno-infra-sense.git
cd infra-sense
```

## Project Structure

```
infra-sense/
├── src/
│   ├── detection/
│   │   ├── mod.ts
│   │   └── utils.ts
│   ├── cli.ts
│   ├── logger.ts
│   └── mod.ts
├── deno.jsonc
└── README.md
```

- `src/detection/mod.ts`: Core detection logic that orchestrates container
  runtime checks.
- `src/detection/utils.ts`: Refactored utility functions for environment-based
  detection.
- `src/cli.ts`: Entry point for the command-line interface.
- `src/logger.ts`: Logging setup and helper functions wrapping `@std/log`.
- `src/mod.ts`: Primary exported function for library usage.
- `deno.jsonc`: Project configuration, tasks, and metadata.
- `README.md`: Project documentation (this file).

## Usage

### As a Library

Import and call the `detect` function in your Deno application:

```ts
import detect from "jsr:@ggpwnkthx/infra-sense";

try {
  const platform = await detect();
  console.log("Detected platform:", platform);
} catch (error) {
  console.error("Detection failed:", error);
}
```

- **`detect()`**: Performs detection and returns a `ContainerPlatform` enum
  value indicating the detected environment.

### Command-Line Interface (CLI)

Run the CLI directly with the required Deno permissions:

```bash
deno run --allow-env --allow-net --allow-read=./deno.jsonc,/var/run/secrets/kubernetes.io/serviceaccount,/.dockerenv src/cli.ts [options]
```

**Options:**

- `--help`: Show usage information and exit.
- `--version`: Display the project name and version (as defined in `deno.jsonc`)
  and exit.
- `--verbose`: Enable debug-level logging.
- `--json`: Output logs in JSON format.
- Any unknown arguments will cause the CLI to exit with status code 1.

**Examples:**

1. **Basic detection:**
   ```bash
   deno run check
   ```

2. **Verbose (debug) output:**
   ```bash
   deno run check --verbose
   ```

3. **JSON-formatted logs:**
   ```bash
   deno run check --json
   ```

## API Reference

### `detect(logger?: Logger): Promise<ContainerPlatform>`

- **Parameters:**
  - `logger` (optional): An instance of `@std/log.Logger`. If not provided, uses
    the default logger from `getDefaultLogger()`.
- **Returns:** A `Promise` that resolves to a value of the `ContainerPlatform`
  enum.

**Example:**

```ts
import detect from "jsr:@ggpwnkthx/infra-sense";

const platform = await detect();
console.log(platform); // e.g., "Docker"
```

### `ContainerPlatform` Enum

Represents all supported container platforms and the host environment:

- `KubernetesCriO` - "Kubernetes (CRI-O)"
- `KubernetesDocker` - "Kubernetes (Docker)"
- `KubernetesOther` - "Kubernetes (other)"
- `Docker` - "Docker"
- `Podman` - "Podman"
- `CRIO` - "CRI-O"
- `DockerCgroup` - "Docker (via environment variable)"
- `Containerd` - "containerd"
- `Rkt` - "rkt"
- `LXCLXD` - "LXC/LXD"
- `SystemdNspawn` - "systemd-nspawn"
- `Host` - "Host (no recognized container)"

## Detection Logic

The refactored detection logic proceeds as follows:

1. **Cache Check**
   - If the last detection result is less than 30 seconds old and `forceRefresh`
     is not enabled, returns the cached enum value.

2. **Kubernetes Check**
   - Uses `detectKubernetes()` which checks:
     1. `KUBERNETES_SERVICE_HOST` environment variable.
     2. Presence of `/var/run/secrets/kubernetes.io/serviceaccount`.
     3. DNS lookup for `kubernetes.default.svc`.
   - If any of these checks succeed, it is considered “inside Kubernetes.”
   - Within Kubernetes, to distinguish CRI-O vs. Docker vs. Other:
     1. `detectCrio()` checks `container` environment variable or
        `/run/.containerenv` contents for “crio.”
     2. `detectDockerCgroup()` checks if `container` environment variable equals
        “docker.”
     3. Otherwise, returns `KubernetesOther`.

3. **Standalone Detectors (Non-Kubernetes)**\
   In order of priority, each detector inspects environment variables or
   specific files:
   1. **Docker** (`detectDockerEnv`) — existence of `/.dockerenv`.
   2. **Podman** (`detectPodman`) — `container` env var equals “podman” or
      `/run/.containerenv` contains “podman.”
   3. **CRI-O** (`detectCrio`) — `container` env var equals “crio” or
      `/run/.containerenv` contains “crio.”
   4. **Docker via Env** (`detectDockerCgroup`) — `container` env var equals
      “docker.”
   5. **containerd** (`detectContainerd`) — `container` env var equals
      “containerd.”
   6. **rkt** (`detectRkt`) — `container` env var equals “rkt.”
   7. **LXC/LXD** (`detectLXC`) — `container` env var equals “lxc.”
   8. **systemd-nspawn** (`detectSystemdNspawn`) — `container` env var equals
      “systemd-nspawn” or existence of `/run/systemd/nspawn/in_container`.

4. **Host Fallback**
   - If no detector matches, returns `Host`.

All detectors use a `safeDetect` wrapper to catch and log errors without halting
the detection process.

## Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ggpwnkthx/deno-infra-sense.git
   cd deno-infra-sense
   ```

2. **Install dependencies:**\
   Deno manages dependencies automatically via remote imports; ensure you have
   Deno installed.

3. **Run Formatting and Linting:**
   ```bash
   deno fmt
   deno lint
   ```

4. **Run CLI in Development Mode:**
   ```bash
   deno run --allow-env=LOG_LEVEL,LOG_JSON,LOG_FILE,CONTAINER,KUBERNETES_SERVICE_HOST --allow-net=kubernetes.default.svc:53 --deny-net --allow-read=./deno.jsonc,/var/run/secrets/kubernetes.io/serviceaccount,/.dockerenv,/run/.containerenv,/run/systemd/nspawn/in_container src/cli.ts --verbose
   ```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository and create a new branch for your feature or bugfix.
2. Write tests and ensure all existing tests pass.
3. Follow the existing code style (see `deno fmt` settings in `deno.jsonc`).
4. Submit a pull request with a clear description of your changes.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE)
file for details.
