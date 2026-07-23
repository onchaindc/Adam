import type { RepositoryModel } from "../../investigation/repository/model.js";
import { evidenceSnippet } from "./source-utils.js";
import type {
  SecurityFindingCandidate,
  SecurityInspector,
} from "./types.js";

interface SolidityFunction {
  readonly startLine: number;
  readonly header: string;
  readonly lines: readonly { readonly number: number; readonly text: string }[];
}

export class SmartContractInspector implements SecurityInspector {
  public readonly category = "smart-contract" as const;

  public inspect(model: RepositoryModel): readonly SecurityFindingCandidate[] {
    if (!model.summary.smartContracts.detected) {
      return [];
    }

    return model.files.flatMap((file) => {
      if (file.extension !== ".sol" || file.content === null) {
        return [];
      }
      return inspectSolidityFile(file.path, file.content);
    });
  }
}

function inspectSolidityFile(
  path: string,
  content: string,
): readonly SecurityFindingCandidate[] {
  const lines = content.split(/\r?\n/);
  const findings: SecurityFindingCandidate[] = [];

  lines.forEach((text, index) => {
    const line = index + 1;
    if (/\btx\.origin\b/.test(text)) {
      findings.push(
        finding(
          "SOL-TX-ORIGIN",
          "tx.origin used for authorization",
          "high",
          path,
          line,
          "Authorization based on tx.origin can be bypassed through intermediary contracts.",
          text,
          "high",
        ),
      );
    }

    if (/\.delegatecall\s*(?:\{|\()/.test(text)) {
      findings.push(
        finding(
          "SOL-DELEGATECALL",
          "Delegatecall usage",
          "high",
          path,
          line,
          "Delegatecall executes external code in the caller's storage context.",
          text,
          "medium",
        ),
      );
    }

    if (/(?:\.call\s*\{[^}]*value|\.call\.value\s*\()/.test(text)) {
      findings.push(
        finding(
          "SOL-EXTERNAL-VALUE-CALL",
          "Low-level external value call",
          "high",
          path,
          line,
          "A low-level value transfer introduces reentrancy and error-handling risk.",
          text,
          "medium",
        ),
      );
    }

    if (
      /\.call\s*(?:\{|\()/.test(text) &&
      !/(?:require\s*\(|assert\s*\(|success\s*[,)])/.test(text)
    ) {
      findings.push(
        finding(
          "SOL-UNCHECKED-LOW-LEVEL-CALL",
          "Unchecked low-level call",
          "high",
          path,
          line,
          "The return status of a low-level call is not visibly checked.",
          text,
          "medium",
        ),
      );
    }
  });

  for (const solidityFunction of collectFunctions(lines)) {
    if (hasReentrancyOrdering(solidityFunction)) {
      const externalCall = solidityFunction.lines.find((line) =>
        /\.(?:call|send|transfer)\s*(?:\{|\()/.test(line.text),
      );
      findings.push(
        finding(
          "SOL-REENTRANCY-ORDERING",
          "External call before state update",
          "critical",
          path,
          externalCall?.number ?? solidityFunction.startLine,
          "The function appears to perform an external call before a later state update.",
          externalCall?.text ?? solidityFunction.header,
          "medium",
        ),
      );
    }

    if (isSensitiveFunctionWithoutAccessControl(solidityFunction)) {
      findings.push(
        finding(
          "SOL-MISSING-ACCESS-CONTROL",
          "Sensitive function lacks visible access control",
          "high",
          path,
          solidityFunction.startLine,
          "A sensitive public or external function has no recognized access-control modifier.",
          solidityFunction.header,
          "low",
        ),
      );
    }
  }

  return findings;
}

function collectFunctions(lines: readonly string[]): readonly SolidityFunction[] {
  const functions: SolidityFunction[] = [];
  let active:
    | {
        startLine: number;
        header: string;
        lines: { number: number; text: string }[];
        depth: number;
        opened: boolean;
      }
    | undefined;

  lines.forEach((text, index) => {
    if (!active && /\bfunction\b/.test(text)) {
      active = {
        startLine: index + 1,
        header: text.trim(),
        lines: [],
        depth: 0,
        opened: false,
      };
    }

    if (!active) {
      return;
    }

    active.lines.push({ number: index + 1, text });
    const openings = (text.match(/\{/g) ?? []).length;
    const closings = (text.match(/\}/g) ?? []).length;
    if (openings > 0) {
      active.opened = true;
    }
    active.depth += openings - closings;

    if (active.opened && active.depth <= 0) {
      functions.push({
        startLine: active.startLine,
        header: active.header,
        lines: active.lines,
      });
      active = undefined;
    }
  });

  return functions;
}

function hasReentrancyOrdering(solidityFunction: SolidityFunction): boolean {
  const externalCallIndex = solidityFunction.lines.findIndex((line) =>
    /\.(?:call|send|transfer)\s*(?:\{|\()/.test(line.text),
  );
  if (externalCallIndex === -1) {
    return false;
  }

  return solidityFunction.lines
    .slice(externalCallIndex + 1)
    .some(
      (line) =>
        /\b[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]+\])?\s*(?:=|\+=|-=)/.test(
          line.text,
        ) && !/\b(?:bool|bytes|uint|int|string|address)\b/.test(line.text),
    );
}

function isSensitiveFunctionWithoutAccessControl(
  solidityFunction: SolidityFunction,
): boolean {
  const header = solidityFunction.header;
  if (!/\b(?:public|external)\b/.test(header)) {
    return false;
  }
  if (
    /\b(?:onlyOwner|onlyRole|auth|authorized|requiresAuth|initializer)\b/.test(
      header,
    )
  ) {
    return false;
  }

  return /\bfunction\s+(?:withdraw|mint|burn|setOwner|transferOwnership|upgrade|pause|unpause|destroy|selfdestruct)\b/i.test(
    header,
  );
}

function finding(
  ruleId: string,
  title: string,
  severity: "critical" | "high",
  file: string,
  line: number,
  description: string,
  evidence: string,
  confidence: "high" | "medium" | "low",
): SecurityFindingCandidate {
  return {
    ruleId,
    category: "smart-contract",
    title,
    severity,
    file,
    line,
    description,
    evidence: evidenceSnippet(evidence),
    confidence,
  };
}
