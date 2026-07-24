import type { CauseRule } from "../types.js";
import { PatternRootCauseDetector } from "./pattern-detector.js";

const rules: readonly CauseRule[] = [
  {
    category: "deployment-failure",
    title: "Deployment health or process startup failed",
    summary:
      "The deployment platform could not keep the application process running or pass its health check.",
    patterns: [
      /\bhealthcheck failed\b/i,
      /\breplicas? never became healthy\b/i,
      /\bcontainer (?:exited|stopped|crashed)\b/i,
      /\bcrashloopbackoff\b/i,
      /\bdeployment failed\b/i,
      /\bapplication failed to respond\b/i,
      /\bservice unavailable\b.*\bhealth/i,
      /\bfailed to bind\b.*\bport\b/i,
      /\bfailed to listen\b/i,
      /\bport\b.*\bnot (?:open|listening)\b/i,
      /\baddress already in use\b/i,
    ],
    baseScore: 61,
    preferredSources: ["runtime", "ci", "build"],
    impact:
      "The new release is unavailable or repeatedly restarting, preventing traffic from reaching a healthy application instance.",
    recommendedFixes: [
      "Inspect the first process error before the health-check cascade and correct the startup command, port, permissions, or required configuration.",
      "Confirm the application listens on the platform-provided host and port.",
      "Redeploy only after the same container starts successfully with production configuration.",
    ],
    prevention: [
      "Use startup and readiness checks that distinguish process failure from dependency unavailability.",
      "Exercise the production container and start command in CI.",
    ],
  },
  {
    category: "build-failure",
    title: "Project build failed",
    summary:
      "Compilation or bundling stopped after a build-time error.",
    patterns: [
      /\bbuild failed\b/i,
      /\bcompilation failed\b/i,
      /\bfailed to compile\b/i,
      /\bwebpack .* error\b/i,
      /\bbundl(?:e|ing)\b.*\bfailed\b/i,
      /\btypescript error\b/i,
      /\bTS\d{4}\b/,
      /\bSyntaxError\b/i,
      /\bcommand .* exited with code [1-9]\b/i,
    ],
    baseScore: 43,
    preferredSources: ["build", "ci"],
    impact:
      "No deployable artifact is produced, so the release cannot progress.",
    recommendedFixes: [
      "Fix the earliest compiler or bundler error; later failures may be cascades.",
      "Use the related file and stack location from the investigation evidence.",
      "Reproduce with the repository's pinned runtime, package manager, and lockfile.",
    ],
    prevention: [
      "Require clean production builds in CI before deployment.",
      "Pin build tooling and fail on type or compilation regressions.",
    ],
  },
  {
    category: "runtime-exception",
    title: "Unhandled runtime exception",
    summary:
      "The application terminated or failed a request because an exception was not handled successfully.",
    patterns: [
      /\bTypeError\b/i,
      /\bReferenceError\b/i,
      /\bRangeError\b/i,
      /\bUnhandledPromiseRejection\b/i,
      /\buncaught exception\b/i,
      /\bNullPointerException\b/i,
      /\bpanic:\b/i,
      /\bsegmentation fault\b/i,
      /\btraceback \(most recent call last\)\b/i,
    ],
    baseScore: 46,
    preferredSources: ["runtime", "stack-trace", "error-message"],
    impact:
      "The affected request, worker, or application process cannot complete normally.",
    recommendedFixes: [
      "Start with the first application-owned stack frame and correct the invalid state or input that triggered the exception.",
      "Add explicit error handling only after fixing the underlying invalid assumption.",
    ],
    prevention: [
      "Add regression tests for the failing input and path.",
      "Capture structured exceptions with request and release identifiers.",
    ],
  },
];

export class ExecutionCauseDetector extends PatternRootCauseDetector {
  public constructor() {
    super("execution-causes", rules);
  }
}
