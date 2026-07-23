import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AuthenticationAuthorizationInspector } from "../dist/analyzers/security/authentication-authorization-inspector.js";
import { ConfigurationInspector } from "../dist/analyzers/security/configuration-inspector.js";
import { DependencyInspector } from "../dist/analyzers/security/dependency-inspector.js";
import { SecretsScanner } from "../dist/analyzers/security/secrets-scanner.js";
import { SecurityAuditEngine } from "../dist/analyzers/security/security-audit-engine.js";
import { SmartContractInspector } from "../dist/analyzers/security/smart-contract-inspector.js";
import { StaticSecurityPatternInspector } from "../dist/analyzers/security/static-security-pattern-inspector.js";

describe("SecurityAuditEngine", () => {
  it("returns structured findings from every eligible inspector", () => {
    const packageJson = JSON.stringify(
      {
        dependencies: {
          lodash: "4.17.20",
          "node-serialize": "0.0.4",
          example: "latest",
        },
      },
      null,
      2,
    );
    const appSource = [
      'const apiKey = "sk-abcdefghijklmnopqrstuv";',
      "const token = jwt.decode(req.body.token);",
      "const role = req.body.role;",
      "const valid = password === req.body.password;",
      "const result = eval(req.body.code);",
      'exec("rm -rf /tmp/data");',
    ].join("\n");
    const configSource = [
      'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";',
      'export default { origin: "*", httpOnly: false };',
    ].join("\n");
    const soliditySource = [
      "contract Vault {",
      "  mapping(address => uint256) balances;",
      "  address owner;",
      "  function withdraw() external {",
      '    msg.sender.call{value: balances[msg.sender]}("");',
      "    balances[msg.sender] = 0;",
      "  }",
      "  function authorize() external {",
      "    require(tx.origin == owner);",
      "  }",
      "  function upgrade(address implementation, bytes memory data) external {",
      "    implementation.delegatecall(data);",
      "  }",
      "}",
    ].join("\n");
    const model = createModel([
      file("package.json", ".json", packageJson),
      file("src/app.ts", ".ts", appSource),
      file("config/security.ts", ".ts", configSource),
      file("contracts/Vault.sol", ".sol", soliditySource),
    ], packageJson, true);
    const result = createEngine().analyze(model);
    const rules = new Set(result.findings.map((finding) => finding.ruleId));

    for (const expectedRule of [
      "SEC-API-TOKEN",
      "DEP-RISKY-NODE-SERIALIZE",
      "DEP-KNOWN-VULNERABLE-RANGE-LODASH",
      "DEP-UNPINNED-SOURCE",
      "AUTH-JWT-DECODE-ONLY",
      "AUTH-PLAINTEXT-PASSWORD-COMPARE",
      "AUTH-CLIENT-CONTROLLED-ROLE",
      "CFG-TLS-VERIFY-DISABLED",
      "CFG-CORS-WILDCARD",
      "STATIC-EVAL",
      "STATIC-CHILD-PROCESS-EXEC",
      "STATIC-DANGEROUS-SHELL-COMMAND",
      "SOL-REENTRANCY-ORDERING",
      "SOL-TX-ORIGIN",
      "SOL-DELEGATECALL",
      "SOL-MISSING-ACCESS-CONTROL",
    ]) {
      assert.equal(rules.has(expectedRule), true, expectedRule);
    }

    assert.deepEqual(result.modulesExecuted, [
      "secrets",
      "dependencies",
      "authentication-authorization",
      "configuration",
      "static-pattern",
      "smart-contract",
    ]);
    assert.equal(result.filesAnalyzed, 4);
    assert.match(result.findings[0].id, /^ADAM-SEC-\d{4}$/);
    assert.equal(
      result.findings.some((finding) =>
        finding.evidence.includes("sk-abcdefghijklmnopqrstuv"),
      ),
      false,
    );

    for (const finding of result.findings) {
      assert.equal(typeof finding.id, "string");
      assert.equal(typeof finding.title, "string");
      assert.equal(typeof finding.severity, "string");
      assert.equal(typeof finding.file, "string");
      assert.equal(typeof finding.description, "string");
      assert.equal(typeof finding.evidence, "string");
      assert.equal(typeof finding.confidence, "string");
    }
  });

  it("does not execute the smart-contract inspector without Solidity", () => {
    const model = createModel(
      [file("src/index.ts", ".ts", "export const ok = true;\n")],
      "{}",
      false,
    );
    const result = createEngine().analyze(model);

    assert.equal(result.modulesExecuted.includes("smart-contract"), false);
    assert.equal(
      result.findings.some((finding) => finding.category === "smart-contract"),
      false,
    );
  });
});

function createEngine() {
  return new SecurityAuditEngine([
    new SecretsScanner(),
    new DependencyInspector(),
    new AuthenticationAuthorizationInspector(),
    new ConfigurationInspector(),
    new StaticSecurityPatternInspector(),
    new SmartContractInspector(),
  ]);
}

function createModel(files, packageJson, solidityDetected) {
  const identity = {
    name: "fixture",
    owner: "adam",
    url: "https://github.com/adam/fixture",
    defaultBranch: "main",
    commitSha: "abc123",
  };

  return {
    identity,
    rootDirectory: "fixture",
    files,
    directories: ["config", "contracts", "src"],
    topLevelEntries: ["config", "contracts", "package.json", "src"],
    manifestContents: { "package.json": packageJson },
    analysisLimitations: [],
    summary: {
      repository: identity,
      languages: [],
      frameworks: [],
      packageManager: { name: "npm", confidence: "high", evidence: [] },
      structure: {
        topLevelEntries: [],
        directories: [],
        fileTree: files.map((item) => item.path),
      },
      docker: { detected: false, files: [] },
      ciCd: { detected: false, files: [] },
      smartContracts: {
        detected: solidityDetected,
        solidityFiles: solidityDetected ? ["contracts/Vault.sol"] : [],
      },
      environmentFiles: [],
      configurationFiles: ["config/security.ts", "package.json"],
      totalFilesScanned: files.length,
      ignoredDirectories: [],
      limitations: [],
    },
  };
}

function file(path, extension, content) {
  return {
    path,
    extension,
    sizeBytes: Buffer.byteLength(content),
    content,
  };
}
