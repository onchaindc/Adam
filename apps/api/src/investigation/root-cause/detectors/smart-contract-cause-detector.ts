import type {
  CauseRule,
  RootCauseCandidate,
  RootCauseContext,
} from "../types.js";
import { PatternRootCauseDetector } from "./pattern-detector.js";

const rules: readonly CauseRule[] = [
  {
    category: "smart-contract-deployment-failure",
    title: "Smart contract deployment failed",
    summary:
      "The deployment transaction or contract creation step failed before the contract became usable.",
    patterns: [
      /\bexecution reverted\b/i,
      /\bcontract deployment failed\b/i,
      /\bcannot estimate gas\b/i,
      /\bgas estimation failed\b/i,
      /\binsufficient funds for (?:gas|intrinsic transaction cost)\b/i,
      /\bnonce too low\b/i,
      /\breplacement transaction underpriced\b/i,
      /\bcontract code size exceeds\b/i,
      /\bout of gas\b/i,
      /\btransaction reverted\b/i,
    ],
    baseScore: 62,
    preferredSources: ["build", "runtime", "ci", "error-message"],
    impact:
      "The target contract is not deployed or initialized, blocking dependent application and protocol operations.",
    recommendedFixes: [
      "Inspect the revert reason, constructor arguments, deployer balance, nonce, gas settings, and target network.",
      "Verify linked libraries and deployment configuration match the compiled artifact.",
      "Simulate the deployment against the intended network state before broadcasting again.",
    ],
    prevention: [
      "Run deterministic deployment simulations and constructor tests in CI.",
      "Record network, compiler, artifact, and deployment configuration versions.",
    ],
  },
];

export class SmartContractCauseDetector extends PatternRootCauseDetector {
  public constructor() {
    super("smart-contract-causes", rules);
  }

  public override detect(
    context: RootCauseContext,
  ): readonly RootCauseCandidate[] {
    if (!context.model.summary.smartContracts.detected) {
      return [];
    }

    return super.detect(context);
  }
}
