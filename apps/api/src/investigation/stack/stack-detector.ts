import type {
  DetectionConfidence,
  RepositoryLanguage,
  StackDetection,
} from "@adam/contracts";

import type { RepositoryFile } from "../repository/model.js";

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".c": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".cs": "C#",
  ".css": "CSS",
  ".cxx": "C++",
  ".go": "Go",
  ".hh": "C++",
  ".hpp": "C++",
  ".hxx": "C++",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
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

const LANGUAGE_EVIDENCE_FILES: Readonly<
  Record<string, readonly string[]>
> = {
  Rust: ["cargo.toml", "cargo.lock"],
  Go: ["go.mod", "go.sum"],
  Python: [
    "pyproject.toml",
    "requirements.txt",
    "pipfile",
    "pipfile.lock",
    "poetry.lock",
    "uv.lock",
    "pdm.lock",
    "setup.py",
    "setup.cfg",
  ],
  Java: ["pom.xml", "build.gradle", "settings.gradle"],
  Kotlin: ["build.gradle.kts", "settings.gradle.kts"],
  Swift: [
    "package.swift",
    "package.resolved",
    "podfile",
    "podfile.lock",
    "cartfile",
    "cartfile.resolved",
  ],
  "C#": [
    "packages.lock.json",
    "paket.dependencies",
    "paket.lock",
    "nuget.config",
    "directory.build.props",
    "directory.build.targets",
  ],
  PHP: ["composer.json", "composer.lock"],
  TypeScript: ["tsconfig.json"],
  JavaScript: ["package.json"],
  Solidity: ["foundry.toml", "hardhat.config.js", "hardhat.config.ts"],
};

const MANIFEST_ONLY_LANGUAGES = new Set([
  "Rust",
  "Go",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "C#",
  "PHP",
  "TypeScript",
  "JavaScript",
  "Solidity",
]);

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
  addFileOrExtensionFramework(
    frameworks,
    paths,
    files,
    "Rust",
    "cargo.toml",
    ".rs",
  );
  addFileOrExtensionFramework(
    frameworks,
    paths,
    files,
    "Python",
    "pyproject.toml",
    ".py",
  );
  addFileOrExtensionFramework(frameworks, paths, files, "Go", "go.mod", ".go");

  addManifestFrameworks(frameworks, manifestContents, [
    ["Actix Web", ["actix-web"]],
    ["Axum", ["axum"]],
    ["Rocket", ["rocket"]],
    ["Gin", ["github.com/gin-gonic/gin"]],
    ["Echo", ["github.com/labstack/echo"]],
    ["Fiber", ["github.com/gofiber/fiber"]],
    ["Chi", ["github.com/go-chi/chi"]],
    ["Django", ["django"]],
    ["Flask", ["flask"]],
    ["FastAPI", ["fastapi"]],
    ["Spring Boot", ["spring-boot", "org.springframework.boot"]],
    ["Micronaut", ["io.micronaut"]],
    ["Quarkus", ["io.quarkus"]],
    ["Ktor", ["io.ktor", "ktor-server"]],
    ["Vapor", ["vapor"]],
    ["ASP.NET Core", ["microsoft.net.sdk.web", "microsoft.aspnetcore"]],
    ["Entity Framework Core", ["microsoft.entityframeworkcore"]],
    ["Laravel", ["laravel/framework"]],
    ["Symfony", ["symfony/framework-bundle"]],
    ["Qt", ["find_package(qt", "qt6::", "qt5::"]],
    ["Boost", ["find_package(boost", "boost::"]],
  ]);
  addSourceFrameworks(frameworks, files, [
    ["SwiftUI", [/\bimport\s+SwiftUI\b/]],
    ["UIKit", [/\bimport\s+UIKit\b/]],
    ["WordPress", [/\bwp_(?:enqueue|insert|update|get)_/]],
    ["Android", [/\bimport\s+android\./]],
  ]);
  addFileFramework(frameworks, paths, "WordPress", ["wp-config.php"]);
  addFileFramework(frameworks, paths, "CMake", ["cmakelists.txt"]);
  addFileFramework(frameworks, paths, "Meson", ["meson.build"]);

  const packageManagers = detectPackageManagers(paths);
  const limitations =
    packageManagers.length > 1
      ? [
          `Multiple package-manager or dependency-manager files detected: ${packageManagers
            .map((manager) => manager.name)
            .join(", ")}.`,
        ]
      : [];

  return {
    languages: detectLanguages(files, paths),
    frameworks: mergeDetections(frameworks),
    packageManager: packageManagers[0] ?? null,
    limitations,
  };
}

function detectLanguages(
  files: readonly RepositoryFile[],
  paths: ReadonlySet<string>,
): readonly RepositoryLanguage[] {
  const counts = new Map<string, number>();
  const sourceEvidence = new Map<string, string[]>();
  const hasCppSource = files.some((file) =>
    [".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"].includes(
      file.extension.toLowerCase(),
    ),
  );

  for (const file of files) {
    const extension = file.extension.toLowerCase();
    const language =
      extension === ".h"
        ? hasCppSource
          ? "C++"
          : "C"
        : LANGUAGE_BY_EXTENSION[extension];
    if (!language) {
      continue;
    }
    counts.set(language, (counts.get(language) ?? 0) + 1);
    const evidence = sourceEvidence.get(language) ?? [];
    if (evidence.length < 5) {
      evidence.push(file.path);
    }
    sourceEvidence.set(language, evidence);
  }

  const manifestEvidence = new Map<string, string[]>();
  for (const [language, filenames] of Object.entries(
    LANGUAGE_EVIDENCE_FILES,
  )) {
    const evidence = findPaths(paths, filenames);
    if (language === "C#" && evidence.length === 0) {
      evidence.push(
        ...[...paths].filter((path) =>
          [".csproj", ".sln"].some((extension) =>
            path.endsWith(extension),
          ),
        ),
      );
    }
    if (evidence.length > 0) {
      manifestEvidence.set(language, evidence);
    }
  }

  const names = new Set(counts.keys());
  for (const language of MANIFEST_ONLY_LANGUAGES) {
    if (manifestEvidence.has(language)) {
      names.add(language);
    }
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return [...names]
    .map((name): RepositoryLanguage => {
      const fileCount = counts.get(name) ?? 0;
      const manifests = manifestEvidence.get(name) ?? [];
      const sources = sourceEvidence.get(name) ?? [];
      return {
        name,
        fileCount,
        percentage:
          total === 0
            ? 0
            : Number(((fileCount / total) * 100).toFixed(2)),
        confidence:
          fileCount > 0 && manifests.length > 0 ? "high" : "medium",
        evidence: [...new Set([...manifests, ...sources])],
      };
    })
    .sort(
      (left, right) =>
        right.fileCount - left.fileCount ||
        confidenceRank(right.confidence) -
          confidenceRank(left.confidence) ||
        left.name.localeCompare(right.name),
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

function addManifestFrameworks(
  detections: StackDetection[],
  manifests: Readonly<Record<string, string>>,
  definitions: readonly (
    readonly [string, readonly string[]]
  )[],
): void {
  for (const [name, patterns] of definitions) {
    const evidence = Object.entries(manifests).flatMap(([path, content]) => {
      const lowerContent = content.toLowerCase();
      return patterns.some((pattern) =>
        lowerContent.includes(pattern.toLowerCase()),
      )
        ? [path]
        : [];
    });
    if (evidence.length > 0) {
      detections.push({
        name,
        confidence: "high",
        evidence: [...new Set(evidence)],
      });
    }
  }
}

function addSourceFrameworks(
  detections: StackDetection[],
  files: readonly RepositoryFile[],
  definitions: readonly (
    readonly [string, readonly RegExp[]]
  )[],
): void {
  for (const [name, patterns] of definitions) {
    const evidence = files
      .filter(
        (file) =>
          file.content !== null &&
          patterns.some((pattern) => pattern.test(file.content ?? "")),
      )
      .slice(0, 10)
      .map((file) => file.path);
    if (evidence.length > 0) {
      detections.push({ name, confidence: "high", evidence });
    }
  }
}

function addFileFramework(
  detections: StackDetection[],
  paths: ReadonlySet<string>,
  name: string,
  filenames: readonly string[],
): void {
  const evidence = findPaths(paths, filenames);
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
  const manifestEvidence = findPaths(paths, [manifest]);
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
  const candidates: readonly {
    readonly name: string;
    readonly filenames: readonly string[];
    readonly extensions?: readonly string[];
    readonly confidence: DetectionConfidence;
  }[] = [
    { name: "pnpm", filenames: ["pnpm-lock.yaml"], confidence: "high" },
    { name: "Yarn", filenames: ["yarn.lock"], confidence: "high" },
    { name: "npm", filenames: ["package-lock.json"], confidence: "high" },
    { name: "Bun", filenames: ["bun.lock", "bun.lockb"], confidence: "high" },
    { name: "Cargo", filenames: ["cargo.lock", "cargo.toml"], confidence: "high" },
    { name: "Go Modules", filenames: ["go.sum", "go.mod"], confidence: "high" },
    { name: "uv", filenames: ["uv.lock"], confidence: "high" },
    { name: "Poetry", filenames: ["poetry.lock"], confidence: "high" },
    { name: "Pipenv", filenames: ["pipfile.lock", "pipfile"], confidence: "high" },
    { name: "PDM", filenames: ["pdm.lock"], confidence: "high" },
    {
      name: "pip",
      filenames: ["requirements.txt", "pyproject.toml"],
      confidence: "medium",
    },
    { name: "Maven", filenames: ["pom.xml"], confidence: "high" },
    {
      name: "Gradle",
      filenames: ["gradle.lockfile", "build.gradle", "build.gradle.kts"],
      confidence: "high",
    },
    {
      name: "Swift Package Manager",
      filenames: ["package.resolved", "package.swift"],
      confidence: "high",
    },
    {
      name: "CocoaPods",
      filenames: ["podfile.lock", "podfile"],
      confidence: "high",
    },
    {
      name: "Carthage",
      filenames: ["cartfile.resolved", "cartfile"],
      confidence: "high",
    },
    {
      name: "NuGet",
      filenames: ["packages.lock.json", "nuget.config"],
      extensions: [".csproj"],
      confidence: "high",
    },
    {
      name: "Paket",
      filenames: ["paket.lock", "paket.dependencies"],
      confidence: "high",
    },
    {
      name: "Composer",
      filenames: ["composer.lock", "composer.json"],
      confidence: "high",
    },
    {
      name: "Conan",
      filenames: ["conan.lock", "conanfile.txt", "conanfile.py"],
      confidence: "high",
    },
    { name: "vcpkg", filenames: ["vcpkg.json"], confidence: "high" },
  ];

  return candidates.flatMap((candidate) => {
    const evidence = [
      ...findPaths(paths, candidate.filenames),
      ...[...paths].filter((path) =>
        (candidate.extensions ?? []).some((extension) =>
          path.endsWith(extension),
        ),
      ),
    ];
    return evidence.length > 0
      ? [{
          name: candidate.name,
          confidence: candidate.confidence,
          evidence: [...new Set(evidence)],
        }]
      : [];
  });
}

function findPaths(
  paths: ReadonlySet<string>,
  filenames: readonly string[],
): string[] {
  return [...paths].filter((path) =>
    filenames.some(
      (filename) =>
        path === filename || path.endsWith(`/${filename}`),
    ),
  );
}

function confidenceRank(confidence: DetectionConfidence): number {
  return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
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
