import type { CauseRule } from "../types.js";
import { PatternRootCauseDetector } from "./pattern-detector.js";

const rules: readonly CauseRule[] = [
  {
    category: "missing-environment-variable",
    title: "Required environment variable is missing",
    summary:
      "Startup or execution failed because required environment configuration was not supplied.",
    patterns: [
      /\bmissing (?:required )?environment variable\b/i,
      /\benvironment variable\b.*\b(?:is required|is missing|not set)\b/i,
      /\b[A-Z][A-Z0-9_]{2,}\b.*\b(?:is required|is not defined|must be set)\b/,
      /\bMissingEnvVar\b/i,
    ],
    baseScore: 66,
    preferredSources: ["runtime", "build", "ci", "error-message"],
    impact:
      "The affected component cannot initialize the integration or configuration that depends on the missing value.",
    recommendedFixes: [
      "Set the named variable in the target environment using the deployment secret or variable manager.",
      "Confirm the variable name and environment scope exactly match the application's startup validation.",
      "Redeploy after validating that required non-secret and secret values are present.",
    ],
    prevention: [
      "Validate required variables at startup with safe error messages.",
      "Maintain an environment-variable manifest without committing secret values.",
    ],
  },
  {
    category: "authentication-failure",
    title: "Authentication credentials were rejected",
    summary:
      "The failing operation was denied because credentials were missing, invalid, expired, or insufficient.",
    patterns: [
      /\b401\b.*\bunauthorized\b/i,
      /\b403\b.*\bforbidden\b/i,
      /\binvalid (?:api key|token|credentials|signature)\b/i,
      /\btoken (?:expired|invalid)\b/i,
      /\bjwt expired\b/i,
      /\bauthentication failed\b/i,
      /\baccess denied\b/i,
      /\bpermission denied\b/i,
    ],
    baseScore: 59,
    preferredSources: ["runtime", "ci", "error-message"],
    impact:
      "The application cannot access the protected service or operation.",
    recommendedFixes: [
      "Verify the deployed credential is present, current, and scoped for the requested operation.",
      "Rotate rejected credentials if exposure or expiration is possible.",
      "Confirm the target environment and audience match the credential issuer configuration.",
    ],
    prevention: [
      "Monitor credential expiry and test authentication during deployment readiness checks.",
      "Use least-privilege managed secrets instead of committed credentials.",
    ],
  },
  {
    category: "database-connection-failure",
    title: "Database connection failed",
    summary:
      "The application could not establish or authenticate a database connection.",
    patterns: [
      /\bECONNREFUSED\b.*(?::5432|:3306|:27017|:6379|database|postgres|mysql|mongo|redis)/i,
      /\bconnection (?:to database )?(?:refused|failed|timed out)\b/i,
      /\bauthentication failed for user\b/i,
      /\btoo many connections\b/i,
      /\bcould not connect to (?:server|database)\b/i,
      /\bdatabase .* (?:does not exist|unavailable)\b/i,
      /\bserver closed the connection unexpectedly\b/i,
      /\bgetaddrinfo ENOTFOUND\b.*(?:db|database|postgres|mysql|mongo|redis)/i,
    ],
    baseScore: 63,
    preferredSources: ["runtime", "error-message"],
    impact:
      "Data-backed requests and startup migrations cannot complete while the database is unreachable.",
    recommendedFixes: [
      "Verify database host, port, name, credentials, TLS settings, and network reachability in the failing environment.",
      "Confirm the database service is running and accepts connections from the application network.",
      "Check connection-pool and migration logs for the earliest database error.",
    ],
    prevention: [
      "Add bounded database readiness checks and connection telemetry.",
      "Validate database configuration separately for each deployment environment.",
    ],
  },
  {
    category: "api-integration-failure",
    title: "External API integration failed",
    summary:
      "A required external HTTP or network API request failed or returned an unsuccessful response.",
    patterns: [
      /\bfetch failed\b/i,
      /\baxioserror\b/i,
      /\bexternal api\b.*\bfailed\b/i,
      /\bECONNRESET\b/i,
      /\bETIMEDOUT\b/i,
      /\bupstream (?:request )?(?:failed|error)\b/i,
      /\bupstream .* (?:4\d\d|5\d\d)\b/i,
      /\brequest failed with status code (?:4\d\d|5\d\d)\b/i,
      /\bHTTP\/\d(?:\.\d)?\s+(?:4\d\d|5\d\d)\b/i,
    ],
    baseScore: 53,
    preferredSources: ["runtime", "error-message"],
    impact:
      "The application cannot complete functionality that depends on the external service.",
    recommendedFixes: [
      "Inspect the target URL, request authentication, timeout, and the first upstream error response.",
      "Confirm the external service is reachable from the deployment network.",
      "Handle transient failures with bounded retries only for safe idempotent operations.",
    ],
    prevention: [
      "Add integration health telemetry, explicit timeouts, and circuit-breaking behavior.",
      "Contract-test critical API requests against supported upstream versions.",
    ],
  },
  {
    category: "configuration-mistake",
    title: "Application configuration is invalid",
    summary:
      "The application rejected a supplied configuration value or option.",
    patterns: [
      /\binvalid configuration\b/i,
      /\bconfiguration validation failed\b/i,
      /\bunknown (?:configuration )?(?:option|property|field)\b/i,
      /\bconfig(?:uration)? .* must be\b/i,
      /\bfailed to load config\b/i,
      /\bmalformed configuration\b/i,
    ],
    baseScore: 52,
    preferredSources: ["build", "runtime", "ci", "error-message"],
    impact:
      "The affected build or runtime component cannot initialize with the supplied settings.",
    recommendedFixes: [
      "Correct the first rejected configuration field using the schema for the deployed application version.",
      "Compare environment-specific configuration with the committed example and deployment variables.",
    ],
    prevention: [
      "Validate configuration in CI and again at startup.",
      "Version configuration schemas alongside application releases.",
    ],
  },
];

export class ConfigurationCauseDetector extends PatternRootCauseDetector {
  public constructor() {
    super("configuration-causes", rules);
  }
}
