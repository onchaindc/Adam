import type {
  RepositoryLanguage,
  StackDetection,
} from "@adam/contracts";

import type { RepositoryFile } from "../repository/model.js";

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".c": "C",
  ".cpp": "C++",
  ".cs": "C#",
  ".css": "CSS",
  ".go": "Go",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".kt": "Kotlin",
  ".php": "PHP",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".sol": "Solidity",
  ".swift": "Swift",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".vue": "Vue",
};

export interface StackDetectionResult {
  readonly languages: readonly RepositoryLanguage[];
  readonly frameworks: readonly StackDetection[];
  readonly packageManager: StackDetection | null;
  readonly limitations: readonly string[];
}

export function detectStack(
  files: readonly RepositoryFile[],
  manifestContents: Readonly<Record<string, string>>,
): StackDetectionResult {
  const paths = new Set(files.map((file) => file.path.toLowerCase()));
  const dependencies = collectPackageDependencies(manifestContents);
  const frameworks: StackDetection[] = [];

  addDependencyFramework(frameworks, dependencies, "Next.js", ["next"]);
  addDependencyFramework(frameworks, dependencies, "React", ["react"]);
  addDependencyFramework(frameworks, dependencies, "Express", ["express"]);
  addDependencyFramework(frameworks, dependencies, "NestJS", ["@nestjs/core"]);
  addDependencyFramework(frameworks, dependencies, "Hardhat", ["hardhat"]);

  addFileFramework(frameworks, paths, "Next.js", [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
  ]);
  addFileFramework(frameworks, paths, "NestJS", ["nest-cli.json"]);
  addFileFramework(frameworks, paths, "Hardhat", [
    "hardhat.config.js",
    "hardhat.config.ts",
  ]);
  addFileFramework(frameworks, paths, "Foundry", ["foundry.toml"]);
  addExtensionFramework(frameworks, files, "Solidity", ".sol");
  addFileOrExtensionFramework(frameworks, paths, files, "Rust", "cargo.toml", ".rs");
  addFileOrExtensionFramework(
    frameworks,
    paths,
    files,
    "Python",
    "pyproject.toml",
    ".py",
  );
  addFileOrExtensionFramework(frameworks, paths, files, "Go", "go.mod", ".go");

  const packageManagers = detectPackageManagers(paths);
  const limitations =
    packageManagers.length > 1
      ? [
          `Multiple package-manager lockfiles detected: ${packageManagers
            .map((manager) => manager.name)
            .join(", ")}.`,
        ]
      : [];

  return {
    languages: detectLanguages(files),
    frameworks: mergeDetections(frameworks),
    packageManager: packageManagers[0] ?? null,
    limitations,
  };
}

function detectLanguages(
  files: readonly RepositoryFile[],
): readonly RepositoryLanguage[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    const language = LANGUAGE_BY_EXTENSION[file.extension.toLowerCase()];
    if (language) {
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([name, fileCount]) => ({
      name,
      fileCount,
      percentage:
        total === 0 ? 0 : Number(((fileCount / total) * 100).toFixed(2)),
    }))
    .sort(
      (left, right) =>
        right.fileCount - left.fileCount || left.name.localeCompare(right.name),
    );
}

function collectPackageDependencies(
  manifestContents: Readonly<Record<string, string>>,
): Map<string, string[]> {
  const dependencies = new Map<string, string[]>();

  for (const [path, content] of Object.entries(manifestContents)) {
    if (!path.toLowerCase().endsWith("package.json")) {
      continue;
    }

    try {
      const manifest = JSON.parse(content) as Record<string, unknown>;
      for (const field of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ]) {
        const values = manifest[field];
        if (!values || typeof values !== "object" || Array.isArray(values)) {
          continue;
        }

        for (const dependency of Object.keys(values)) {
          const evidence = dependencies.get(dependency) ?? [];
          evidence.push(`${path}#${field}.${dependency}`);
          dependencies.set(dependency, evidence);
        }
      }
    } catch {
      continue;
    }
  }

  return dependencies;
}

function addDependencyFramework(
  detections: StackDetection[],
  dependencies: ReadonlyMap<string, string[]>,
  name: string,
  packages: readonly string[],
): void {
  const evidence = packages.flatMap(
    (dependency) => dependencies.get(dependency) ?? [],
  );
  if (evidence.length > 0) {
    detections.push({ name, confidence: "high", evidence });
  }
}

function addFileFramework(
  detections: StackDetection[],
  paths: ReadonlySet<string>,
  name: string,
  filenames: readonly string[],
): void {
  const evidence = [...paths].filter((path) =>
    filenames.some(
      (filename) => path === filename || path.endsWith(`/${filename}`),
    ),
  );
  if (evidence.length > 0) {
    detections.push({ name, confidence: "high", evidence });
  }
}

function addExtensionFramework(
  detections: StackDetection[],
  files: readonly RepositoryFile[],
  name: string,
  extension: string,
): void {
  const evidence = files
    .filter((file) => file.extension.toLowerCase() === extension)
    .slice(0, 10)
    .map((file) => file.path);
  if (evidence.length > 0) {
    detections.push({ name, confidence: "high", evidence });
  }
}

function addFileOrExtensionFramework(
  detections: StackDetection[],
  paths: ReadonlySet<string>,
  files: readonly RepositoryFile[],
  name: string,
  manifest: string,
  extension: string,
): void {
  const manifestEvidence = [...paths].filter(
    (path) => path === manifest || path.endsWith(`/${manifest}`),
  );
  const sourceEvidence = files
    .filter((file) => file.extension.toLowerCase() === extension)
    .slice(0, 5)
    .map((file) => file.path);
  const evidence = [...manifestEvidence, ...sourceEvidence];

  if (evidence.length > 0) {
    detections.push({
      name,
      confidence: manifestEvidence.length > 0 ? "high" : "medium",
      evidence,
    });
  }
}

function detectPackageManagers(
  paths: ReadonlySet<string>,
): readonly StackDetection[] {
  const candidates = [
    ["pnpm", "pnpm-lock.yaml"],
    ["Yarn", "yarn.lock"],
    ["npm", "package-lock.json"],
    ["Bun", "bun.lock"],
    ["Bun", "bun.lockb"],
  ] as const;

  return candidates.flatMap(([name, lockfile]) => {
    const evidence = [...paths].filter(
      (path) => path === lockfile || path.endsWith(`/${lockfile}`),
    );
    return evidence.length > 0
      ? [{ name, confidence: "high" as const, evidence }]
      : [];
  });
}

function mergeDetections(
  detections: readonly StackDetection[],
): readonly StackDetection[] {
  const merged = new Map<string, StackDetection>();

  for (const detection of detections) {
    const existing = merged.get(detection.name);
    if (!existing) {
      merged.set(detection.name, detection);
      continue;
    }

    merged.set(detection.name, {
      name: detection.name,
      confidence:
        existing.confidence === "high" || detection.confidence === "high"
          ? "high"
          : "medium",
      evidence: [...new Set([...existing.evidence, ...detection.evidence])],
    });
  }

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
