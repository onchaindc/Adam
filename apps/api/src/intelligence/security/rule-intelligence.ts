import type {
  DetectionConfidence,
  SecurityFinding,
  SecurityFindingIntelligence,
  SecurityLikelihood,
} from "@adam/contracts";

interface RuleIntelligenceProfile {
  readonly whyItMatters: string;
  readonly potentialImpact: string;
  readonly suggestedRemediation: string;
  readonly baseLikelihood: SecurityLikelihood;
}

const exactProfiles: Readonly<Record<string, RuleIntelligenceProfile>> = {
  "SEC-AWS-ACCESS-KEY": secretProfile(
    "An exposed AWS key can grant programmatic access to cloud resources.",
    "Unauthorized cloud access, data exposure, resource modification, or unexpected infrastructure cost.",
    "Revoke and rotate the key immediately, remove it from repository history, and load the replacement from an approved secret store.",
  ),
  "SEC-GITHUB-TOKEN": secretProfile(
    "A GitHub token may provide repository or organization permissions outside this codebase.",
    "Unauthorized source access, workflow manipulation, release tampering, or further secret exposure.",
    "Revoke and rotate the token, remove it from repository history, and replace source-based credentials with a scoped secret-store reference.",
  ),
  "SEC-API-TOKEN": secretProfile(
    "Committed API tokens can be copied by anyone with repository access and may remain valid outside the application.",
    "Unauthorized API use, data access, quota consumption, or charges within the token's granted scope.",
    "Rotate the token, purge it from repository history where feasible, and inject a least-privilege replacement through runtime secrets.",
  ),
  "SEC-PRIVATE-KEY": secretProfile(
    "Private key material is an authentication credential that must never be recoverable from source control.",
    "Impersonation, unauthorized signing, account takeover, or irreversible asset loss depending on the key's purpose.",
    "Treat the key as compromised: revoke or replace it, remove it from repository history, and use a managed signer or secret store.",
  ),
  "SEC-HARDCODED-CREDENTIAL": secretProfile(
    "Hardcoded credentials are difficult to rotate and are exposed to every reader and copy of the repository.",
    "Unauthorized access to the protected service or lateral movement using reused credentials.",
    "Rotate the credential, remove it from source and history, and retrieve a scoped replacement from runtime secret configuration.",
  ),
  "SEC-CREDENTIAL-URL": secretProfile(
    "Credentials embedded in URLs are commonly exposed through source control, process listings, proxies, and logs.",
    "Unauthorized access to the referenced service and accidental credential propagation into operational telemetry.",
    "Rotate the credential and construct the connection using separately supplied secret values rather than an inline credential URL.",
  ),
  "SEC-MNEMONIC": secretProfile(
    "A mnemonic can control every account derived from the recovery phrase.",
    "Complete and potentially irreversible loss of control over derived wallets and assets.",
    "Move assets to keys derived from a new offline mnemonic, remove the phrase from repository history, and use an approved signing system.",
  ),
  "AUTH-JWT-NO-EXPIRY": {
    whyItMatters:
      "Ignoring token expiration allows an otherwise valid stolen token to remain usable after its intended lifetime.",
    potentialImpact:
      "Extended account or service impersonation until the token is revoked through another mechanism.",
    suggestedRemediation:
      "Enable expiration validation, enforce short token lifetimes, and use an explicit refresh or revocation strategy.",
    baseLikelihood: "high",
  },
  "AUTH-JWT-DECODE-ONLY": {
    whyItMatters:
      "Decoding a JWT reads attacker-controlled claims without proving that a trusted issuer signed them.",
    potentialImpact:
      "Authentication or authorization bypass if decoded claims influence identity, role, or access decisions.",
    suggestedRemediation:
      "Verify the token signature, issuer, audience, algorithm, and expiration before consuming any claim.",
    baseLikelihood: "high",
  },
  "AUTH-INSECURE-SESSION-COOKIE": {
    whyItMatters:
      "A cookie without Secure protection may be transmitted over an unencrypted connection.",
    potentialImpact:
      "Session disclosure and account impersonation when an insecure transport path is reachable.",
    suggestedRemediation:
      "Set Secure in production, enforce HTTPS, and review SameSite and HttpOnly controls for the same cookie.",
    baseLikelihood: "medium",
  },
  "AUTH-PLAINTEXT-PASSWORD-COMPARE": {
    whyItMatters:
      "Direct password comparison suggests plaintext handling instead of a slow, salted password hash verification flow.",
    potentialImpact:
      "Credential disclosure from storage or memory and rapid compromise of reused passwords after a data breach.",
    suggestedRemediation:
      "Store only salted hashes produced by a modern password hashing function and use its constant-time verification API.",
    baseLikelihood: "high",
  },
  "AUTH-CLIENT-CONTROLLED-ROLE": {
    whyItMatters:
      "Authorization attributes supplied by the client are not a trustworthy source of privileges.",
    potentialImpact:
      "Privilege escalation or access to actions and data reserved for another role.",
    suggestedRemediation:
      "Resolve roles and permissions from trusted server-side identity data and enforce authorization at every protected operation.",
    baseLikelihood: "high",
  },
  "CFG-TLS-VERIFY-DISABLED": {
    whyItMatters:
      "Disabling certificate validation removes the endpoint identity guarantee provided by TLS.",
    potentialImpact:
      "Interception or modification of sensitive network traffic by a man-in-the-middle.",
    suggestedRemediation:
      "Restore certificate verification and configure the correct trust chain instead of bypassing validation.",
    baseLikelihood: "medium",
  },
  "CFG-CORS-WILDCARD": {
    whyItMatters:
      "A wildcard origin permits browser clients from any website to read responses when other CORS conditions allow it.",
    potentialImpact:
      "Cross-origin exposure of API data or expansion of the attack surface for browser-accessible endpoints.",
    suggestedRemediation:
      "Allowlist only required trusted origins and review credentialed requests, methods, and headers.",
    baseLikelihood: "medium",
  },
  "CFG-DEBUG-ENABLED": {
    whyItMatters:
      "Debug behavior can expose internals that are useful to an attacker and may weaken normal error handling.",
    potentialImpact:
      "Disclosure of stack traces, configuration, paths, or sensitive runtime data in deployed environments.",
    suggestedRemediation:
      "Disable debug behavior in production and expose only sanitized, structured operational diagnostics.",
    baseLikelihood: "medium",
  },
  "CFG-COOKIE-HTTPONLY-DISABLED": {
    whyItMatters:
      "A cookie without HttpOnly can be read by browser JavaScript.",
    potentialImpact:
      "Session or token theft if script execution occurs in the application's origin.",
    suggestedRemediation:
      "Enable HttpOnly for authentication cookies and review Secure and SameSite settings.",
    baseLikelihood: "medium",
  },
  "CFG-DATABASE-SSL-DISABLED": {
    whyItMatters:
      "Disabling database TLS can expose credentials and application data on the network path.",
    potentialImpact:
      "Database credential theft, data disclosure, or traffic modification where the network is not fully trusted.",
    suggestedRemediation:
      "Require encrypted database connections and validate the server certificate using the deployment trust chain.",
    baseLikelihood: "medium",
  },
  "STATIC-EVAL": codeExecutionProfile(
    "eval executes text as code in the current JavaScript context.",
    "Arbitrary code execution with application privileges if untrusted data reaches the call.",
    "Remove eval or replace it with a constrained parser and an explicit allowlist of supported operations.",
  ),
  "STATIC-FUNCTION-CONSTRUCTOR": codeExecutionProfile(
    "The Function constructor compiles strings as executable JavaScript.",
    "Arbitrary code execution with application privileges if attacker-controlled text reaches the constructor.",
    "Replace dynamic compilation with explicit functions, a safe parser, or a constrained expression evaluator.",
  ),
  "STATIC-CHILD-PROCESS-EXEC": codeExecutionProfile(
    "Shell execution combines command parsing with operating-system process creation.",
    "Command injection or unauthorized system changes if command content includes untrusted input.",
    "Avoid a shell where possible; invoke a fixed executable with a validated argument array and least-privilege permissions.",
  ),
  "STATIC-SPAWN-SHELL": codeExecutionProfile(
    "Enabling a shell adds command interpretation to child-process execution.",
    "Command injection if untrusted values are interpolated into the command or arguments.",
    "Disable shell execution and pass validated arguments directly to a fixed executable.",
  ),
  "STATIC-DANGEROUS-SHELL-COMMAND": codeExecutionProfile(
    "The detected command can delete data, weaken permissions, or execute downloaded content.",
    "Destructive system changes or remote code execution if the command is reachable in a deployed workflow.",
    "Remove the command or replace it with a narrowly scoped, reviewed operation that does not pipe remote content into a shell.",
    "high",
  ),
  "STATIC-NODE-UNSERIALIZE": deserializationProfile(
    "JavaScript object deserialization can invoke executable behavior embedded in crafted payloads.",
    "Arbitrary code execution if serialized input can be influenced by an attacker.",
    "Use a data-only format such as JSON with schema validation and reject executable object representations.",
  ),
  "STATIC-PYTHON-PICKLE": deserializationProfile(
    "Python pickle is a code-capable serialization format and is unsafe for untrusted data.",
    "Arbitrary Python code execution during object loading.",
    "Use a data-only serialization format with strict schema validation, or cryptographically authenticate data before loading it.",
  ),
  "STATIC-PHP-UNSERIALIZE": deserializationProfile(
    "PHP object deserialization can instantiate attacker-selected classes and trigger magic methods.",
    "Object injection, data manipulation, or code execution depending on available classes.",
    "Use JSON or another data-only format with schema validation and do not unserialize untrusted input.",
  ),
  "SOL-TX-ORIGIN": {
    whyItMatters:
      "tx.origin identifies the transaction initiator rather than the immediate trusted caller.",
    potentialImpact:
      "Authorization bypass through a malicious intermediary contract.",
    suggestedRemediation:
      "Authorize against msg.sender and use explicit role or ownership checks.",
    baseLikelihood: "medium",
  },
  "SOL-DELEGATECALL": {
    whyItMatters:
      "Delegatecall executes foreign code with the caller's storage, balance, and authority.",
    potentialImpact:
      "Storage corruption, privilege takeover, or asset loss if the implementation target or layout is unsafe.",
    suggestedRemediation:
      "Restrict and validate implementation targets, protect upgrades with access control, and verify storage-layout compatibility.",
    baseLikelihood: "medium",
  },
  "SOL-EXTERNAL-VALUE-CALL": {
    whyItMatters:
      "A low-level value call transfers control to external code and requires explicit failure and reentrancy handling.",
    potentialImpact:
      "Reentrancy, inconsistent accounting, or failed transfers that are not handled safely.",
    suggestedRemediation:
      "Apply checks-effects-interactions, verify the return value, and use a reentrancy guard where appropriate.",
    baseLikelihood: "medium",
  },
  "SOL-UNCHECKED-LOW-LEVEL-CALL": {
    whyItMatters:
      "Low-level calls report failure through a return value rather than automatically reverting.",
    potentialImpact:
      "The contract may continue after a failed external operation and commit inconsistent state.",
    suggestedRemediation:
      "Capture and require the call success value, and handle returned data explicitly.",
    baseLikelihood: "medium",
  },
  "SOL-REENTRANCY-ORDERING": {
    whyItMatters:
      "An external call before a state update can allow the recipient to re-enter while stale state is still visible.",
    potentialImpact:
      "Repeated withdrawal, accounting corruption, or asset loss if the call path is exploitable.",
    suggestedRemediation:
      "Move state changes before the external call and add a reentrancy guard for sensitive entry points.",
    baseLikelihood: "medium",
  },
  "SOL-MISSING-ACCESS-CONTROL": {
    whyItMatters:
      "Sensitive state-changing functions should prove that the caller has the required authority.",
    potentialImpact:
      "Unauthorized minting, withdrawal, ownership change, upgrade, or emergency-control actions.",
    suggestedRemediation:
      "Add an explicit owner or role check and test both authorized and unauthorized callers.",
    baseLikelihood: "low",
  },
};

export function buildFindingIntelligence(
  finding: SecurityFinding,
): SecurityFindingIntelligence {
  const profile = findProfile(finding);
  const confidenceLevel = analysisConfidence(finding);
  const location =
    finding.line === null ? finding.file : `${finding.file}:${finding.line}`;

  return {
    explanation: `${finding.id} identifies "${finding.title}" at ${location}. ${finding.description} The recorded evidence is: ${finding.evidence}`,
    whyItMatters: profile.whyItMatters,
    potentialImpact: profile.potentialImpact,
    likelihood: constrainLikelihood(
      profile.baseLikelihood,
      confidenceLevel,
    ),
    suggestedRemediation: profile.suggestedRemediation,
    confidenceLevel,
    evidenceReferences: [finding.id],
  };
}

function findProfile(finding: SecurityFinding): RuleIntelligenceProfile {
  if (isFixedPackageCacheCleanup(finding)) {
    return {
      whyItMatters:
        "Recursive deletion is generally sensitive, but the cited command targets the fixed operating-system package cache path during image construction.",
      potentialImpact:
        "The recorded evidence does not show attacker-controlled path selection or deletion of application data.",
      suggestedRemediation:
        "Keep the deletion path fixed, do not interpolate repository input, and retain the command only as package-cache cleanup.",
      baseLikelihood: "low",
    };
  }

  const exact = exactProfiles[finding.ruleId];
  if (exact) {
    return exact;
  }

  if (finding.ruleId.startsWith("DEP-RISKY-")) {
    return {
      whyItMatters:
        "The manifest declares a dependency with a known maintenance, compromise, or unsafe-behavior concern in Adam's offline policy.",
      potentialImpact:
        "Exposure depends on how the package is used, but may include vulnerable behavior or supply-chain risk.",
      suggestedRemediation:
        "Confirm whether the package is required, replace or upgrade it, and validate the resolved lockfile before deployment.",
      baseLikelihood: "medium",
    };
  }
  if (finding.ruleId.startsWith("DEP-KNOWN-VULNERABLE-RANGE-")) {
    return {
      whyItMatters:
        "The declared range begins below Adam's versioned offline minimum-safe baseline.",
      potentialImpact:
        "A vulnerable package version may be installed, depending on the resolved lockfile and package-manager behavior.",
      suggestedRemediation:
        "Raise the declared minimum to a reviewed safe release, regenerate the lockfile, and verify the resolved version.",
      baseLikelihood: "low",
    };
  }
  if (finding.ruleId === "DEP-UNPINNED-SOURCE") {
    return {
      whyItMatters:
        "Floating or remote dependency references can resolve to different code without a manifest change.",
      potentialImpact:
        "Non-reproducible builds or supply-chain compromise if the referenced source changes.",
      suggestedRemediation:
        "Pin an immutable reviewed version or commit and commit the corresponding lockfile.",
      baseLikelihood: "medium",
    };
  }

  return fallbackProfile(finding);
}

function fallbackProfile(finding: SecurityFinding): RuleIntelligenceProfile {
  return {
    whyItMatters: `The finding belongs to the ${finding.category} security category and represents behavior that requires contextual review.`,
    potentialImpact:
      "The impact depends on whether untrusted input or an unauthorized caller can reach the affected code path.",
    suggestedRemediation:
      "Review the cited evidence, confirm reachability and trust boundaries, then remove or constrain the risky behavior.",
    baseLikelihood: "low",
  };
}

function constrainLikelihood(
  base: SecurityLikelihood,
  confidence: DetectionConfidence,
): SecurityLikelihood {
  const rank: readonly SecurityLikelihood[] = ["low", "medium", "high"];
  const baseIndex = rank.indexOf(base);
  const confidenceCeiling =
    confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
  return rank[Math.min(baseIndex, confidenceCeiling)] ?? "low";
}

function analysisConfidence(
  finding: SecurityFinding,
): DetectionConfidence {
  const lowerPath = finding.file.toLowerCase();
  if (
    isFixedPackageCacheCleanup(finding) ||
    lowerPath.endsWith(".md") ||
    lowerPath.includes("/docs/") ||
    lowerPath.startsWith("docs/") ||
    lowerPath.includes("/test/") ||
    lowerPath.includes("/tests/") ||
    lowerPath.includes("/fixture") ||
    lowerPath.includes("/example")
  ) {
    return "low";
  }
  return finding.confidence;
}

function isFixedPackageCacheCleanup(finding: SecurityFinding): boolean {
  return (
    finding.ruleId === "STATIC-DANGEROUS-SHELL-COMMAND" &&
    finding.file.toLowerCase().endsWith("dockerfile") &&
    /rm\s+-rf\s+\/var\/lib\/apt\/lists\/\*/i.test(finding.evidence)
  );
}

function secretProfile(
  whyItMatters: string,
  potentialImpact: string,
  suggestedRemediation: string,
): RuleIntelligenceProfile {
  return {
    whyItMatters,
    potentialImpact,
    suggestedRemediation,
    baseLikelihood: "high",
  };
}

function codeExecutionProfile(
  whyItMatters: string,
  potentialImpact: string,
  suggestedRemediation: string,
  baseLikelihood: SecurityLikelihood = "medium",
): RuleIntelligenceProfile {
  return {
    whyItMatters,
    potentialImpact,
    suggestedRemediation,
    baseLikelihood,
  };
}

function deserializationProfile(
  whyItMatters: string,
  potentialImpact: string,
  suggestedRemediation: string,
): RuleIntelligenceProfile {
  return {
    whyItMatters,
    potentialImpact,
    suggestedRemediation,
    baseLikelihood: "medium",
  };
}
