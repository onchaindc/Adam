import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, posix } from "node:path";

import type {
  RuntimeAnalysis,
  RuntimeAnalysisCheck,
} from "@adam/contracts";

import type { RepositoryModel } from "../investigation/repository/model.js";

export interface RuntimeAnalyzer {
  analyze(model: RepositoryModel): Promise<RuntimeAnalysis>;
}

export interface DockerRuntimeAnalyzerOptions {
  readonly enabled: boolean;
  readonly image: string;
  readonly timeoutMs: number;
  readonly memoryMb: number;
  readonly cpus: number;
  readonly pidsLimit: number;
  readonly maxPackages: number;
  readonly maxOutputBytes?: number;
}

interface NodePackageCheck {
  readonly packagePath: string;
  readonly workingDirectory: string;
  readonly installCommand: string;
  readonly commands: readonly string[];
}

interface CommandResult {
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly output: string;
  readonly timedOut: boolean;
}

export class DockerRuntimeAnalyzer implements RuntimeAnalyzer {
  private readonly maxOutputBytes: number;

  public constructor(private readonly options: DockerRuntimeAnalyzerOptions) {
    this.maxOutputBytes = options.maxOutputBytes ?? 8_000;
  }

  public async analyze(model: RepositoryModel): Promise<RuntimeAnalysis> {
    if (!this.options.enabled) {
      return skipped(
        "Sandboxed runtime analysis is disabled by deployment configuration.",
      );
    }

    const docker = await runCommand(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      model.rootDirectory,
      Math.min(this.options.timeoutMs, 15_000),
      this.maxOutputBytes,
    );
    if (docker.exitCode !== 0) {
      return skipped(
        "Docker isolation is unavailable; Adam refused to execute repository code on the host.",
      );
    }

    const packages = discoverNodePackageChecks(model).slice(
      0,
      this.options.maxPackages,
    );
    if (packages.length === 0) {
      return skipped(
        "No supported Node.js package with a lockfile and build or test script was found.",
      );
    }

    const checks: RuntimeAnalysisCheck[] = [];
    for (const packageCheck of packages) {
      checks.push(...(await this.analyzePackage(model, packageCheck)));
    }

    return {
      status: checks.some((check) => check.status === "failed")
        ? "failed"
        : "completed",
      sandbox: "docker",
      checks,
      limitation:
        "Sandboxed build and test execution improves runtime evidence but does not by itself prove vulnerability reachability or exploitability.",
    };
  }

  private async analyzePackage(
    model: RepositoryModel,
    packageCheck: NodePackageCheck,
  ): Promise<readonly RuntimeAnalysisCheck[]> {
    const volume = `adam-runtime-${randomUUID()}`;
    const checks: RuntimeAnalysisCheck[] = [];

    try {
      const volumeResult = await runCommand(
        "docker",
        ["volume", "create", volume],
        model.rootDirectory,
        15_000,
        this.maxOutputBytes,
      );
      if (volumeResult.exitCode !== 0) {
        return [
          failedCheck(
            packageCheck.packagePath,
            packageCheck.installCommand,
            volumeResult,
          ),
        ];
      }

      const prepare = await runCommand(
        "docker",
        this.containerArgs({
          network: "bridge",
          repositoryDirectory: model.rootDirectory,
          volume,
          shellCommand: [
            "set -eu",
            "cp -a /input/. /workspace/",
            `cd /workspace/${packageCheck.workingDirectory}`,
            "corepack enable",
            packageCheck.installCommand,
          ].join(" && "),
        }),
        model.rootDirectory,
        this.options.timeoutMs,
        this.maxOutputBytes,
      );
      if (prepare.exitCode !== 0) {
        return [
          failedCheck(
            packageCheck.packagePath,
            packageCheck.installCommand,
            prepare,
          ),
        ];
      }

      for (const command of packageCheck.commands) {
        const result = await runCommand(
          "docker",
          this.containerArgs({
            network: "none",
            repositoryDirectory: model.rootDirectory,
            volume,
            shellCommand: [
              "set -eu",
              `cd /workspace/${packageCheck.workingDirectory}`,
              "corepack enable",
              command,
            ].join(" && "),
          }),
          model.rootDirectory,
          this.options.timeoutMs,
          this.maxOutputBytes,
        );
        checks.push({
          packagePath: packageCheck.packagePath,
          command,
          status: result.exitCode === 0 ? "passed" : "failed",
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          outputExcerpt: sanitizeOutput(result.output, this.maxOutputBytes),
        });
      }
      return checks;
    } finally {
      await runCommand(
        "docker",
        ["volume", "rm", "--force", volume],
        model.rootDirectory,
        15_000,
        this.maxOutputBytes,
      );
    }
  }

  private containerArgs(input: {
    readonly network: "bridge" | "none";
    readonly repositoryDirectory: string;
    readonly volume: string;
    readonly shellCommand: string;
  }): readonly string[] {
    return [
      "run",
      "--rm",
      "--pull",
      "missing",
      "--network",
      input.network,
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--memory",
      `${this.options.memoryMb}m`,
      "--cpus",
      String(this.options.cpus),
      "--pids-limit",
      String(this.options.pidsLimit),
      "--read-only",
      "--tmpfs",
      "/tmp:rw,nosuid,nodev,noexec,size=64m",
      "--mount",
      `type=bind,source=${input.repositoryDirectory},target=/input,readonly`,
      "--mount",
      `type=volume,source=${input.volume},target=/workspace`,
      this.options.image,
      "sh",
      "-lc",
      input.shellCommand,
    ];
  }
}

function discoverNodePackageChecks(
  model: RepositoryModel,
): readonly NodePackageCheck[] {
  const checks: NodePackageCheck[] = [];
  const manifests = new Set(Object.keys(model.manifestContents));

  for (const [path, content] of Object.entries(model.manifestContents)) {
    if (!path.toLowerCase().endsWith("package.json")) {
      continue;
    }
    if (!isSafeRepositoryPath(path)) {
      continue;
    }

    let manifest: {
      readonly scripts?: Readonly<Record<string, unknown>>;
    };
    try {
      manifest = JSON.parse(content) as typeof manifest;
    } catch {
      continue;
    }

    const scripts = manifest.scripts ?? {};
    const packageDirectory = normalizeDirectory(dirname(path));
    const packagePath = packageDirectory || ".";
    const manager = packageManagerForDirectory(manifests, packageDirectory);
    if (!manager) {
      continue;
    }

    const commands: string[] = [];
    if (isUsefulScript(scripts.test)) {
      commands.push(`${manager.command} test`);
    }
    if (isUsefulScript(scripts.build)) {
      commands.push(`${manager.command} build`);
    }
    if (commands.length === 0) {
      continue;
    }

    checks.push({
      packagePath,
      workingDirectory: packageDirectory || ".",
      installCommand: manager.installCommand,
      commands,
    });
  }

  return checks.sort((left, right) =>
    left.packagePath.localeCompare(right.packagePath),
  );
}

function packageManagerForDirectory(
  manifests: ReadonlySet<string>,
  directory: string,
): { readonly command: string; readonly installCommand: string } | null {
  const prefix = directory ? `${directory}/` : "";
  if (manifests.has(`${prefix}pnpm-lock.yaml`)) {
    return {
      command: "pnpm",
      installCommand:
        "pnpm install --frozen-lockfile --ignore-scripts --reporter=append-only",
    };
  }
  if (
    manifests.has(`${prefix}package-lock.json`) ||
    manifests.has(`${prefix}npm-shrinkwrap.json`)
  ) {
    return {
      command: "npm run",
      installCommand: "npm ci --ignore-scripts --no-audit --no-fund",
    };
  }
  if (manifests.has(`${prefix}yarn.lock`)) {
    return {
      command: "yarn",
      installCommand: "yarn install --immutable --mode=skip-builds",
    };
  }
  return null;
}

function isUsefulScript(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/no test specified/i.test(value)
  );
}

function isSafeRepositoryPath(path: string): boolean {
  return (
    !path.includes("..") &&
    /^[A-Za-z0-9._/-]+$/.test(path) &&
    !posix.isAbsolute(path)
  );
}

function normalizeDirectory(path: string): string {
  return path === "." ? "" : path.replaceAll("\\", "/");
}

function failedCheck(
  packagePath: string,
  command: string,
  result: CommandResult,
): RuntimeAnalysisCheck {
  return {
    packagePath,
    command,
    status: "failed",
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    outputExcerpt: sanitizeOutput(
      result.timedOut ? `Timed out. ${result.output}` : result.output,
      8_000,
    ),
  };
}

function skipped(limitation: string): RuntimeAnalysis {
  return {
    status: "skipped",
    sandbox: "docker",
    checks: [],
    limitation,
  };
}

function runCommand(
  executable: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<CommandResult> {
  return new Promise((resolvePromise) => {
    const startedAt = Date.now();
    let output = "";
    let settled = false;
    let timedOut = false;
    const child = spawn(executable, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (chunk: Buffer) => {
      if (Buffer.byteLength(output) < maxOutputBytes) {
        output += chunk.toString("utf8");
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolvePromise({
          exitCode: null,
          durationMs: Date.now() - startedAt,
          output: `${output}${error.message}`,
          timedOut,
        });
      }
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolvePromise({
          exitCode: code,
          durationMs: Date.now() - startedAt,
          output,
          timedOut,
        });
      }
    });
  });
}

function sanitizeOutput(value: string, maxBytes: number): string {
  const normalized = value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
    .trim();
  return Buffer.from(normalized).subarray(0, maxBytes).toString("utf8");
}
