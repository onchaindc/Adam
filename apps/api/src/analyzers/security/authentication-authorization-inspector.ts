import type { RepositoryModel } from "../../investigation/repository/model.js";
import {
  collectSourceLines,
  evidenceSnippet,
  isLikelyTestOrExample,
} from "./source-utils.js";
import type {
  SecurityFindingCandidate,
  SecurityInspector,
} from "./types.js";

const authRules = [
  {
    ruleId: "AUTH-JWT-NO-EXPIRY",
    title: "JWT expiration validation disabled",
    severity: "high",
    pattern: /ignoreExpiration\s*:\s*true/,
    description: "JWT verification explicitly ignores token expiration.",
  },
  {
    ruleId: "AUTH-JWT-DECODE-ONLY",
    title: "JWT decoded without verification",
    severity: "high",
    pattern: /\b(?:jwt|jsonwebtoken)\.decode\s*\(/,
    description:
      "A JWT is decoded without cryptographic signature verification on the same operation.",
  },
  {
    ruleId: "AUTH-INSECURE-SESSION-COOKIE",
    title: "Session cookie marked insecure",
    severity: "medium",
    pattern: /\bsecure\s*:\s*false/,
    description: "A session or authentication cookie is configured without Secure.",
  },
  {
    ruleId: "AUTH-PLAINTEXT-PASSWORD-COMPARE",
    title: "Plaintext password comparison",
    severity: "high",
    pattern:
      /(?:password|passwd|pwd)\s*(?:===|==)\s*(?:req\.|request\.|body\.|user\.)/i,
    description:
      "Password-like data is compared directly instead of using a password hash verifier.",
  },
  {
    ruleId: "AUTH-CLIENT-CONTROLLED-ROLE",
    title: "Authorization role sourced from request input",
    severity: "high",
    pattern:
      /(?:role|permission|isAdmin)\s*[:=]\s*(?:req|request)\.(?:body|query|params)/i,
    description:
      "An authorization attribute is assigned directly from client-controlled input.",
  },
] as const;

export class AuthenticationAuthorizationInspector
  implements SecurityInspector
{
  public readonly category = "authentication-authorization" as const;

  public inspect(model: RepositoryModel): readonly SecurityFindingCandidate[] {
    const findings: SecurityFindingCandidate[] = [];

    for (const source of collectSourceLines(model.files)) {
      for (const rule of authRules) {
        if (!rule.pattern.test(source.text)) {
          continue;
        }

        findings.push({
          ruleId: rule.ruleId,
          category: this.category,
          title: rule.title,
          severity: rule.severity,
          file: source.file.path,
          line: source.line,
          description: rule.description,
          evidence: evidenceSnippet(source.text),
          confidence: isLikelyTestOrExample(source.file.path) ? "low" : "high",
        });
      }
    }

    return findings;
  }
}
