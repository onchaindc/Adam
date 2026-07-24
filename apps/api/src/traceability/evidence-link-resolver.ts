import type {
  EvidenceTraceability,
  FindingTraceability,
  TraceableEvidence,
  TraceableRecommendation,
  TraceableRecommendedSecurityFix,
} from "@adam/contracts";

import type {
  UntracedRootCauseInvestigationResponse,
  UntracedSecurityAuditResponse,
} from "./types.js";

export interface SecurityTraceabilityResolution {
  readonly traceability: EvidenceTraceability;
  readonly recommendedFixOrder: readonly TraceableRecommendedSecurityFix[];
}

export interface RootCauseTraceabilityResolution {
  readonly traceability: EvidenceTraceability;
}

export class EvidenceLinkResolver {
  public resolveSecurity(
    response: UntracedSecurityAuditResponse,
  ): SecurityTraceabilityResolution {
    const evidence = response.findings.map(
      (finding, index): TraceableEvidence => ({
        evidenceId: `ADAM-SEC-EVID-${pad(index + 1)}`,
        relatedFindingIds: [finding.id],
        repositoryFile: finding.file,
        lineNumbers: finding.line === null ? [] : [finding.line],
        ruleId: finding.ruleId,
        confidence: finding.confidence,
        sourceService: "security-audit",
        excerpt: finding.evidence,
      }),
    );
    const findingTraceability = response.findings.map(
      (finding, index): FindingTraceability => {
        const resolvedEvidence = evidence[index];
        if (!resolvedEvidence) {
          throw new Error(`Missing evidence for finding ${finding.id}.`);
        }
        return {
          findingId: finding.id,
          evidenceIds: [resolvedEvidence.evidenceId],
          repositoryFile: finding.file,
          lineNumbers: finding.line === null ? [] : [finding.line],
          ruleId: finding.ruleId,
          confidence: finding.confidence,
          sourceService: "security-audit",
        };
      },
    );
    const recommendedFixOrder = response.recommendedFixOrder.map(
      (fix, index): TraceableRecommendedSecurityFix => {
        const finding = response.findings.find(
          (candidate) => candidate.id === fix.findingId,
        );
        const trace = findingTraceability.find(
          (candidate) => candidate.findingId === fix.findingId,
        );
        if (!finding || !trace) {
          throw new Error(
            `Recommendation references unknown finding ${fix.findingId}.`,
          );
        }

        return {
          ...fix,
          recommendationId: `ADAM-SEC-REC-${pad(index + 1)}`,
          text: fix.suggestedRemediation,
          relatedFindingIds: [fix.findingId],
          evidenceIds: trace.evidenceIds,
          repositoryFile: trace.repositoryFile,
          lineNumbers: trace.lineNumbers,
          ruleId: finding.ruleId,
          confidence: finding.confidence,
          sourceService: "security-audit",
        };
      },
    );

    return {
      recommendedFixOrder,
      traceability: {
        complete: true,
        findings: findingTraceability,
        evidence,
        recommendations: recommendedFixOrder,
      },
    };
  }

  public resolveRootCause(
    response: UntracedRootCauseInvestigationResponse,
  ): RootCauseTraceabilityResolution {
    const findingId = "ADAM-RCI-FIND-0001";
    const ruleId = `ROOT-${response.rootCause.category.toUpperCase()}`;
    const repositoryFile = response.relatedFiles[0] ?? null;
    const lineNumbers = [
      ...new Set(response.supportingLogEntries.map((entry) => entry.line)),
    ];
    const confidence = response.confidence.level;
    const evidence = response.evidence.map(
      (item): TraceableEvidence => ({
        evidenceId: item.id,
        relatedFindingIds: [findingId],
        repositoryFile:
          item.type === "repository-file"
            ? item.reference
            : repositoryFile,
        lineNumbers:
          item.type === "log-entry" || item.type === "stack"
            ? lineNumbers
            : [],
        ruleId,
        confidence,
        sourceService: "root-cause-investigation",
        excerpt: item.excerpt,
      }),
    );
    const findingTraceability: FindingTraceability = {
      findingId,
      evidenceIds: evidence.map((item) => item.evidenceId),
      repositoryFile,
      lineNumbers,
      ruleId,
      confidence,
      sourceService: "root-cause-investigation",
    };
    const recommendations = response.recommendedFixes.map(
      (text, index): TraceableRecommendation => ({
        recommendationId: `ADAM-RCI-REC-${pad(index + 1)}`,
        text,
        relatedFindingIds: [findingId],
        evidenceIds: findingTraceability.evidenceIds,
        repositoryFile,
        lineNumbers,
        ruleId,
        confidence,
        sourceService: "root-cause-investigation",
      }),
    );

    return {
      traceability: {
        complete: true,
        findings: [findingTraceability],
        evidence,
        recommendations: evidence.length > 0 ? recommendations : [],
      },
    };
  }

  public merge(
    traces: readonly EvidenceTraceability[],
  ): EvidenceTraceability {
    return {
      complete: true,
      findings: uniqueBy(
        traces.flatMap((trace) => trace.findings),
        (item) => item.findingId,
      ),
      evidence: uniqueBy(
        traces.flatMap((trace) => trace.evidence),
        (item) => item.evidenceId,
      ),
      recommendations: uniqueBy(
        traces.flatMap((trace) => trace.recommendations),
        (item) => item.recommendationId,
      ),
    };
  }
}

function pad(value: number): string {
  return String(value).padStart(4, "0");
}

function uniqueBy<Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): readonly Value[] {
  const unique = new Map<string, Value>();
  for (const value of values) {
    unique.set(key(value), value);
  }
  return [...unique.values()];
}
