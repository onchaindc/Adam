import type {
  RuntimeAnalysis,
  SecurityAuditEnrichment,
  SecurityProfile,
} from "@adam/contracts";

import type {
  LiveVulnerabilityInspection,
  LiveVulnerabilityInspector,
} from "../analyzers/security/live-vulnerability-inspector.js";
import type { SecurityFindingCandidate } from "../analyzers/security/types.js";
import type { RepositoryModel } from "../investigation/repository/model.js";
import type { RuntimeAnalyzer } from "../runtime/docker-runtime-analyzer.js";

export interface SecurityEnrichmentResult {
  readonly findings: readonly SecurityFindingCandidate[];
  readonly limitations: readonly string[];
  readonly summary: SecurityAuditEnrichment;
}

export class SecurityEnrichmentEngine {
  public constructor(
    private readonly liveVulnerabilities: LiveVulnerabilityInspector,
    private readonly runtimeAnalyzer: RuntimeAnalyzer,
  ) {}

  public async analyze(
    model: RepositoryModel,
    profile: SecurityProfile,
  ): Promise<SecurityEnrichmentResult> {
    const live =
      profile === "static"
        ? notRequestedLiveVulnerabilities()
        : await this.liveVulnerabilities.inspect(model);
    const runtime =
      profile === "sandboxed"
        ? await this.runtimeAnalyzer.analyze(model)
        : notRequestedRuntimeAnalysis();

    return {
      findings: live.findings,
      limitations: [
        ...live.limitations,
        ...(runtime.limitation ? [runtime.limitation] : []),
      ],
      summary: {
        liveVulnerabilities: live.summary,
        runtimeAnalysis: runtime,
      },
    };
  }
}

export class NoopSecurityEnrichmentEngine {
  public async analyze(
    _model: RepositoryModel,
    _profile: SecurityProfile,
  ): Promise<SecurityEnrichmentResult> {
    return staticSecurityEnrichment();
  }
}

export function staticSecurityEnrichment(): SecurityEnrichmentResult {
  return {
    findings: [],
    limitations: [],
    summary: {
      liveVulnerabilities: notRequestedLiveVulnerabilities().summary,
      runtimeAnalysis: notRequestedRuntimeAnalysis(),
    },
  };
}

function notRequestedLiveVulnerabilities(): LiveVulnerabilityInspection {
  return {
    findings: [],
    limitations: [],
    summary: {
      status: "not-requested",
      provider: "OSV",
      queriedAt: null,
      packagesChecked: 0,
      advisoriesFound: 0,
      limitation: null,
    },
  };
}

function notRequestedRuntimeAnalysis(): RuntimeAnalysis {
  return {
    status: "not-requested",
    sandbox: "docker",
    checks: [],
    limitation: null,
  };
}
