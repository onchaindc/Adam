import type { RepositoryModel } from "../../investigation/repository/model.js";
import { evidenceSnippet } from "./source-utils.js";
import type {
  SecurityFindingCandidate,
  SecurityInspector,
} from "./types.js";

const riskyPackages: Readonly<
  Record<
    string,
    {
      readonly severity: "critical" | "high" | "medium";
      readonly title: string;
      readonly description: string;
    }
  >
> = {
  "node-serialize": {
    severity: "critical",
    title: "Risky deserialization dependency",
    description:
      "The dependency is associated with unsafe JavaScript deserialization patterns.",
  },
  "event-stream": {
    severity: "high",
    title: "Historically compromised dependency",
    description:
      "The dependency has a history of supply-chain compromise and requires explicit review.",
  },
  request: {
    severity: "medium",
    title: "Deprecated HTTP dependency",
    description:
      "The dependency is deprecated and no longer receives normal maintenance.",
  },
};

const minimumKnownSafeVersions: Readonly<
  Record<string, readonly [number, number, number]>
> = {
  lodash: [4, 17, 21],
  minimist: [1, 2, 8],
  "serialize-javascript": [6, 0, 2],
};

export class DependencyInspector implements SecurityInspector {
  public readonly category = "dependencies" as const;

  public inspect(model: RepositoryModel): readonly SecurityFindingCandidate[] {
    const findings: SecurityFindingCandidate[] = [];

    for (const [path, content] of Object.entries(model.manifestContents)) {
      if (path.toLowerCase().endsWith("package.json")) {
        findings.push(...inspectPackageJson(path, content));
      }
    }

    return findings;
  }
}

function inspectPackageJson(
  path: string,
  content: string,
): readonly SecurityFindingCandidate[] {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const findings: SecurityFindingCandidate[] = [];
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const dependencies = manifest[field];
    if (
      !dependencies ||
      typeof dependencies !== "object" ||
      Array.isArray(dependencies)
    ) {
      continue;
    }

    for (const [name, rawVersion] of Object.entries(dependencies)) {
      if (typeof rawVersion !== "string") {
        continue;
      }

      const line = findDependencyLine(content, name);
      const evidence = evidenceSnippet(`"${name}": "${rawVersion}"`);
      const riskyPackage = riskyPackages[name.toLowerCase()];
      if (riskyPackage) {
        findings.push({
          ruleId: `DEP-RISKY-${normalizeRuleName(name)}`,
          category: "dependencies",
          title: riskyPackage.title,
          severity: riskyPackage.severity,
          file: path,
          line,
          description: riskyPackage.description,
          evidence,
          confidence: "high",
        });
      }

      if (isUnpinnedDependency(rawVersion)) {
        findings.push({
          ruleId: "DEP-UNPINNED-SOURCE",
          category: "dependencies",
          title: "Unpinned dependency source",
          severity: "medium",
          file: path,
          line,
          description:
            "The dependency uses a floating tag, wildcard, URL, or Git source.",
          evidence,
          confidence: "high",
        });
      }

      const minimum = minimumKnownSafeVersions[name.toLowerCase()];
      const declared = extractVersion(rawVersion);
      if (minimum && declared && compareVersion(declared, minimum) < 0) {
        findings.push({
          ruleId: `DEP-KNOWN-VULNERABLE-RANGE-${normalizeRuleName(name)}`,
          category: "dependencies",
          title: "Dependency range may include known vulnerable versions",
          severity: "high",
          file: path,
          line,
          description:
            "The declared dependency range begins below Adam's offline minimum-safe baseline.",
          evidence,
          confidence: rawVersion.startsWith("^") || rawVersion.startsWith("~")
            ? "medium"
            : "high",
        });
      }
    }
  }

  return findings;
}

function findDependencyLine(content: string, dependency: string): number | null {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) =>
    line.includes(`"${dependency}"`),
  );
  return index === -1 ? null : index + 1;
}

function isUnpinnedDependency(version: string): boolean {
  const normalized = version.trim().toLowerCase();
  return (
    normalized === "*" ||
    normalized === "latest" ||
    normalized.startsWith("git") ||
    normalized.startsWith("http:") ||
    normalized.startsWith("https:") ||
    normalized.startsWith("github:")
  );
}

function extractVersion(
  version: string,
): readonly [number, number, number] | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match?.[1] && match[2] && match[3]
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : null;
}

function compareVersion(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  const pairs = [
    [left[0], right[0]],
    [left[1], right[1]],
    [left[2], right[2]],
  ] as const;

  for (const [leftPart, rightPart] of pairs) {
    const difference = leftPart - rightPart;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function normalizeRuleName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
}
