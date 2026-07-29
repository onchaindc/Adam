import { parse as parseYaml } from "yaml";

import type { RepositoryModel } from "../../investigation/repository/model.js";

export interface PackageCoordinate {
  readonly ecosystem: "Go" | "npm" | "Packagist" | "PyPI";
  readonly name: string;
  readonly version: string;
  readonly sourceFile: string;
}

export interface PackageCoordinateExtraction {
  readonly packages: readonly PackageCoordinate[];
  readonly limitations: readonly string[];
}

export function extractPackageCoordinates(
  model: RepositoryModel,
): PackageCoordinateExtraction {
  const packages = new Map<string, PackageCoordinate>();
  const limitations: string[] = [];

  for (const [path, content] of Object.entries(model.manifestContents)) {
    const filename = path.toLowerCase().split("/").at(-1) ?? "";

    try {
      if (filename === "package-lock.json" || filename === "npm-shrinkwrap.json") {
        extractPackageLock(path, content, packages);
      } else if (filename === "pnpm-lock.yaml") {
        extractPnpmLock(path, content, packages);
      } else if (filename === "package.json") {
        extractExactPackageJsonVersions(path, content, packages);
      } else if (filename === "requirements.txt") {
        extractRequirements(path, content, packages);
      } else if (filename === "go.sum") {
        extractGoSum(path, content, packages);
      } else if (filename === "composer.lock") {
        extractComposerLock(path, content, packages);
      }
    } catch {
      limitations.push(`${path} could not be parsed for live vulnerability analysis.`);
    }
  }

  return {
    packages: [...packages.values()].sort(
      (left, right) =>
        left.ecosystem.localeCompare(right.ecosystem) ||
        left.name.localeCompare(right.name) ||
        left.version.localeCompare(right.version),
    ),
    limitations,
  };
}

function extractPackageLock(
  path: string,
  content: string,
  packages: Map<string, PackageCoordinate>,
): void {
  const lock = JSON.parse(content) as {
    readonly packages?: Readonly<
      Record<string, { readonly name?: unknown; readonly version?: unknown }>
    >;
    readonly dependencies?: Readonly<
      Record<string, { readonly version?: unknown }>
    >;
  };

  if (lock.packages) {
    for (const [packagePath, value] of Object.entries(lock.packages)) {
      if (!packagePath || typeof value.version !== "string") {
        continue;
      }
      const name =
        typeof value.name === "string"
          ? value.name
          : packageNameFromNodeModulesPath(packagePath);
      if (name) {
        addPackage(packages, {
          ecosystem: "npm",
          name,
          version: value.version,
          sourceFile: path,
        });
      }
    }
  }

  if (lock.dependencies) {
    for (const [name, value] of Object.entries(lock.dependencies)) {
      if (typeof value.version === "string") {
        addPackage(packages, {
          ecosystem: "npm",
          name,
          version: value.version,
          sourceFile: path,
        });
      }
    }
  }
}

function extractPnpmLock(
  path: string,
  content: string,
  packages: Map<string, PackageCoordinate>,
): void {
  const lock = parseYaml(content) as {
    readonly packages?: Readonly<Record<string, unknown>>;
  };

  for (const rawKey of Object.keys(lock.packages ?? {})) {
    const coordinate = parsePnpmPackageKey(rawKey);
    if (coordinate) {
      addPackage(packages, {
        ecosystem: "npm",
        ...coordinate,
        sourceFile: path,
      });
    }
  }
}

function parsePnpmPackageKey(
  rawKey: string,
): { readonly name: string; readonly version: string } | null {
  const key = rawKey.replace(/^\/+/, "").split("(")[0]?.trim() ?? "";
  const separator = key.lastIndexOf("@");
  if (separator <= 0 || separator === key.length - 1) {
    return null;
  }

  const name = key.slice(0, separator);
  const version = key.slice(separator + 1);
  return name && isExactVersion(version) ? { name, version } : null;
}

function extractExactPackageJsonVersions(
  path: string,
  content: string,
  packages: Map<string, PackageCoordinate>,
): void {
  const manifest = JSON.parse(content) as Record<string, unknown>;
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const values = manifest[field];
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      continue;
    }
    for (const [name, rawVersion] of Object.entries(values)) {
      if (typeof rawVersion === "string" && isExactVersion(rawVersion)) {
        addPackage(packages, {
          ecosystem: "npm",
          name,
          version: rawVersion,
          sourceFile: path,
        });
      }
    }
  }
}

function extractRequirements(
  path: string,
  content: string,
  packages: Map<string, PackageCoordinate>,
): void {
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+!-]+)\s*(?:#.*)?$/.exec(
      line,
    );
    if (match?.[1] && match[2]) {
      addPackage(packages, {
        ecosystem: "PyPI",
        name: match[1],
        version: match[2],
        sourceFile: path,
      });
    }
  }
}

function extractGoSum(
  path: string,
  content: string,
  packages: Map<string, PackageCoordinate>,
): void {
  for (const line of content.split(/\r?\n/)) {
    const [name, rawVersion] = line.trim().split(/\s+/, 3);
    const version = rawVersion?.replace(/\/go\.mod$/, "");
    if (name && version?.startsWith("v")) {
      addPackage(packages, {
        ecosystem: "Go",
        name,
        version,
        sourceFile: path,
      });
    }
  }
}

function extractComposerLock(
  path: string,
  content: string,
  packages: Map<string, PackageCoordinate>,
): void {
  const lock = JSON.parse(content) as {
    readonly packages?: readonly unknown[];
    readonly "packages-dev"?: readonly unknown[];
  };
  for (const value of [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])]) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const candidate = value as { readonly name?: unknown; readonly version?: unknown };
    if (typeof candidate.name === "string" && typeof candidate.version === "string") {
      addPackage(packages, {
        ecosystem: "Packagist",
        name: candidate.name,
        version: candidate.version.replace(/^v/, ""),
        sourceFile: path,
      });
    }
  }
}

function packageNameFromNodeModulesPath(path: string): string | null {
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index === -1) {
    return null;
  }
  const remainder = path.slice(index + marker.length);
  const segments = remainder.split("/");
  return segments[0]?.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : (segments[0] ?? null);
}

function isExactVersion(version: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version.trim());
}

function addPackage(
  packages: Map<string, PackageCoordinate>,
  coordinate: PackageCoordinate,
): void {
  const key = `${coordinate.ecosystem}:${coordinate.name.toLowerCase()}:${coordinate.version}`;
  if (!packages.has(key)) {
    packages.set(key, coordinate);
  }
}
