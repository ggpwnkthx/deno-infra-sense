# Infra-Sense

A TypeScript-based, lightweight Deno library and CLI tool designed to detect the
container platform or host environment in which a Deno process is running. It
supports various container runtimes (Docker, Podman, CRI-O, containerd, Rkt,
LXC/LXD, systemd-nspawn) and Kubernetes, providing a simple API and command-line
interface for reliable environment detection.

## Table of Contents

- [Features](#features)
- [Permissions](#permissions)
- [Project Structure](#project-structure)
- [Usage](#usage)
  - [Library API](#library-api)
  - [Command-Line Interface (CLI)](#command-line-interface-cli)
- [Detection Logic](#detection-logic)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Container Runtime Detection**: Identifies standalone runtimes such as
  Docker, Podman, CRI-O, containerd, Rkt, LXC/LXD, and systemd-nspawn by
  inspecting environment variables or runtime-specific files.
- **Kubernetes Detection**: Detects if running inside a Kubernetes cluster by
  checking environment variables, service account files, and in-cluster DNS
  resolution. Distinguishes between CRI-O, Docker, or other runtimes when in
  Kubernetes.
- **Host Fallback**: If no container runtime is detected, classifies the
  environment as Host.
- **Safe Detection**: All detection routines are wrapped to catch and log errors
  without interrupting detection flow.
- **Caching**: Results are cached for 30 seconds to avoid repeated checks within
  a short timeframe.
- **Minimal Dependencies**: Built on Deno standard libraries and
  `@ggpwnkthx/generic-cli` for CLI functionality.
- **Logger Abstraction**: Accepts any object implementing a simple `Logger`
  interface for debug, info, warning, and error messages.

## Permissions

The detection routines require the following Deno permissions:

- `--allow-env`
  - `CONTAINER`
  - `KUBERNETES_SERVICE_HOST`
- `--allow-read`
  - `./deno.jsonc`
  - `/var/run/secrets/kubernetes.io/serviceaccount`
  - `/.dockerenv`
  - `/run/.containerenv`
  - `/run/systemd/nspawn/in_container`
- `--allow-net`
  - `kubernetes.default.svc:53`

Example invocation for CLI:

```bash
deno run \
  --allow-env=CONTAINER,KUBERNETES_SERVICE_HOST \
  --allow-read=./deno.jsonc,/var/run/secrets/kubernetes.io/serviceaccount,/.dockerenv,/run/.containerenv,/run/systemd/nspawn/in_container \
  --allow-net=kubernetes.default.svc:53 \
  src/cli.ts
```

## Project Structure

```
infra-sense/
├── src/
│   ├── detection/
│   │   ├── mod.ts         # Core detection orchestrator
│   │   ├── types.ts       # ContainerPlatform enums and types
│   │   └── utils.ts       # Individual detection routines
│   ├── cli.ts             # CLI entrypoint using `@ggpwnkthx/generic-cli`
│   ├── mod.ts             # Library API: `detect` function
│   └── types.ts           # Re-exports detection types
├── deno.jsonc             # Project configuration, imports, and tasks
├── mod.ts                 # Re-exports library API and types from `src/`
└── README.md              # This documentation
```

## Usage

### Library API

Import and call the `detect` function in your Deno application:

```ts
import detect from "jsr:@ggpwnkthx/infra-sense";

async function main() {
  try {
    const platform = await detect();
    console.log(platform);
  } catch (error) {
    console.error("Detection failed:", error);
  }
}

if (import.meta.main) {
  main();
}
```

- **Function**: `detect(logger?: Logger): Promise<ContainerPlatform>`
  - `logger` (optional): Any object implementing the `Logger` interface
    (defaults to `console`).
  - Resolves to a `ContainerPlatform` object with properties:
    - `type`: `"kubernetes" | "standalone" | "host"`
    - `runtime`: runtime identifier (e.g., `"docker"`, `"crio"`, `"none"`)
    - `displayName`: human-friendly display string (e.g., `"Docker"`,
      `"Kubernetes (CRI-O)"`).

### Command-Line Interface (CLI)

The CLI bundled in `src/cli.ts` registers a `detect` command:

```bash
deno run src/cli.ts detect
```

**Options:**

- `--help` / `-h`: Show help.
- `--version` / `-V`: Print version from `deno.jsonc`.
- `--quiet` / `-q`: Suppress non-error output.
- `--verbose` / `-v`: Enable debug output.
- `--output=[text|json|yaml]`: Control output format (default: `text`).

**Examples:**

- **Basic detection (text output)**
  ```bash
  deno run src/cli.ts detect
  ```

- **JSON output**
  ```bash
  deno run src/cli.ts --output=json detect
  ```

- **Verbose (debug) logs**
  ```bash
  deno run src/cli.ts --verbose detect
  ```

## Detection Logic

1. **Cache Check**
   - Cached result is returned if it is less than 30 seconds old and
     `forceRefresh` is not set.

2. **Kubernetes Detection**
   - Checks `KUBERNETES_SERVICE_HOST` environment variable.
   - Verifies existence of `/var/run/secrets/kubernetes.io/serviceaccount`.
   - Performs DNS resolution for `kubernetes.default.svc`.
   - If running in Kubernetes:
     1. Check CRI-O via `Content of /run/.containerenv` or `container` env var.
     2. Check Docker via cgroup (`container` env var).
     3. If neither, classify as `KubernetesOther`.

3. **Standalone Runtime Detection (in order)**
   - **Docker**: existence of `/.dockerenv`.
   - **Podman**: `container` env var equals `"podman"` or `/run/.containerenv`
     contains `"podman"`.
   - **CRI-O**: `container` env var equals `"crio"` or `/run/.containerenv`
     contains `"crio"`.
   - **Docker via cgroup**: `container` env var equals `"docker"`.
   - **containerd**: `container` env var equals `"containerd"`.
   - **rkt**: `container` env var equals `"rkt"`.
   - **LXC/LXD**: `container` env var equals `"lxc"`.
   - **systemd-nspawn**: `container` env var equals `"systemd-nspawn"` or
     existence of `/run/systemd/nspawn/in_container`.

4. **Host Fallback**
   - If no container detected, returns the `Host` platform (`runtime: "none"`).

All detection functions are wrapped in a `safeDetect` helper to catch errors,
log them, and return `false` rather than throwing.

## Development

1. **Clone the repository**

```bash
git clone https://github.com/ggpwnkthx/deno-infra-sense.git
cd infra-sense
```

2. **Ensure Deno is installed**\
   Requires Deno v2.0 or higher.

## Contributing

Contributions and feedback are welcome. Please follow these guidelines:

1. Fork the repository and create a feature branch.
2. Adhere to the existing code style (run `deno fmt`).
3. Add or update tests if necessary.
4. Submit a pull request with a description of your changes.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE)
file for details.
