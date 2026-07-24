import type { CauseRule } from "../types.js";
import { PatternRootCauseDetector } from "./pattern-detector.js";

const rules: readonly CauseRule[] = [
  {
    category: "module-resolution",
    title: "Module resolution failed",
    summary:
      "The failure is most consistent with an imported module or package that the build/runtime cannot resolve.",
    patterns: [
      /\bCannot find module\b/i,
      /\bCannot find package\b/i,
      /\bERR_MODULE_NOT_FOUND\b/i,
      /\bModuleNotFoundError\b/i,
      /\bTS2307\b/i,
      /\bmodule not found\b/i,
      /\bfailed to resolve import\b/i,
      /\bcould not resolve ["'][^"']+["']/i,
    ],
    baseScore: 62,
    preferredSources: ["build", "runtime", "ci", "stack-trace"],
    impact:
      "The application cannot compile or start because a required import is unavailable at the resolved path.",
    recommendedFixes: [
      "Confirm the referenced package or local file exists with the exact expected casing and path.",
      "Install or declare the missing dependency and regenerate the lockfile with the approved package manager.",
      "Verify build aliases and module-resolution settings match the deployment environment.",
    ],
    prevention: [
      "Run clean-install and production-build checks in CI.",
      "Keep lockfiles committed and test imports on a case-sensitive filesystem.",
    ],
  },
  {
    category: "version-incompatibility",
    title: "Runtime or dependency version is incompatible",
    summary:
      "The logs indicate that the selected runtime or package version does not satisfy a required version range.",
    patterns: [
      /\bEBADENGINE\b/i,
      /\bunsupported engine\b/i,
      /\brequires (?:node|npm|pnpm|python|rust|go)\b/i,
      /\brequires node(?:\.js)?\s*(?:version)?\b/i,
      /\bincompatible version\b/i,
      /\bversion mismatch\b/i,
      /\bunsupported (?:node|python|rust|go) version\b/i,
      /\bnot supported on (?:node|python)\b/i,
    ],
    baseScore: 60,
    preferredSources: ["build", "runtime", "ci"],
    impact:
      "Installation, compilation, or startup cannot proceed under the deployed toolchain version.",
    recommendedFixes: [
      "Align the deployment runtime with the version declared by the project and its dependencies.",
      "Pin the runtime and package-manager versions in CI and deployment configuration.",
      "Upgrade or downgrade the incompatible dependency only after validating its supported range.",
    ],
    prevention: [
      "Enforce runtime versions through engines, toolchain files, and CI checks.",
      "Test dependency updates against every supported runtime version.",
    ],
  },
  {
    category: "dependency-failure",
    title: "Dependency installation or resolution failed",
    summary:
      "The dependency solver could not produce or install a compatible dependency graph.",
    patterns: [
      /\bERESOLVE\b/i,
      /\bunable to resolve dependency tree\b/i,
      /\bpeer dependency\b.*\bconflict\b/i,
      /\bdependency resolution failed\b/i,
      /\blocked lockfile\b/i,
      /\bfrozen lockfile\b.*\b(?:failed|outdated)\b/i,
      /\b(?:npm|pnpm|yarn|pip|cargo) (?:install|resolution).*\bfailed\b/i,
    ],
    baseScore: 58,
    preferredSources: ["build", "ci"],
    impact:
      "The project cannot install the dependency set required to build or run.",
    recommendedFixes: [
      "Identify the conflicting package ranges in the first dependency error rather than later cascade errors.",
      "Align direct dependency versions and regenerate the lockfile using the repository's package manager.",
      "Avoid force or legacy-peer-dependency bypasses unless the resulting graph has been validated.",
    ],
    prevention: [
      "Run frozen-lockfile installation in CI.",
      "Use automated dependency updates with build and test validation.",
    ],
  },
];

export class DependencyCauseDetector extends PatternRootCauseDetector {
  public constructor() {
    super("dependency-causes", rules);
  }
}
