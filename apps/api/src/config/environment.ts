import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    STATE_FILE: z.string().min(1).default(".data/runtime-state.json"),
    A2MCP_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(240_000)
      .default(120_000),
    REPOSITORY_CLONE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(60_000),
    REPOSITORY_MAX_FILES: z.coerce
      .number()
      .int()
      .min(1)
      .max(100_000)
      .default(10_000),
    REPOSITORY_MAX_DEPTH: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25),
    REPOSITORY_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(5_000_000)
      .default(512_000),
    REPOSITORY_MAX_TOTAL_SOURCE_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(100_000_000)
      .default(10_000_000),
    INVESTIGATION_MAX_LOG_INPUTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),
    INVESTIGATION_MAX_LOG_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(1_000_000)
      .default(200_000),
    INVESTIGATION_MAX_LOG_LINES: z.coerce
      .number()
      .int()
      .min(10)
      .max(50_000)
      .default(5_000),
    GITHUB_TOKEN: z.string().min(1).optional(),
    GITHUB_API_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(30_000),
    OSV_API_URL: z.string().url().default("https://api.osv.dev"),
    OSV_API_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(20_000),
    OSV_MAX_PACKAGES: z.coerce
      .number()
      .int()
      .min(1)
      .max(5_000)
      .default(500),
    OSV_MAX_ADVISORIES: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000)
      .default(100),
    GIT_HISTORY_MAX_COMMITS: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000)
      .default(100),
    GIT_HISTORY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(30_000),
    GIT_HISTORY_MAX_PATCH_BYTES: z.coerce
      .number()
      .int()
      .min(64_000)
      .max(50_000_000)
      .default(5_000_000),
    RUNTIME_SANDBOX_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    RUNTIME_SANDBOX_IMAGE: z
      .string()
      .min(1)
      .default("node:24.18.0-bookworm-slim"),
    RUNTIME_SANDBOX_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(240_000)
      .default(90_000),
    RUNTIME_SANDBOX_MEMORY_MB: z.coerce
      .number()
      .int()
      .min(128)
      .max(8_192)
      .default(768),
    RUNTIME_SANDBOX_CPUS: z.coerce
      .number()
      .min(0.25)
      .max(8)
      .default(1),
    RUNTIME_SANDBOX_PIDS: z.coerce
      .number()
      .int()
      .min(16)
      .max(1_024)
      .default(128),
    RUNTIME_SANDBOX_MAX_PACKAGES: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(4),
    PULL_REQUEST_MAX_FILES: z.coerce
      .number()
      .int()
      .min(1)
      .max(3_000)
      .default(300),
    PULL_REQUEST_MAX_PATCH_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(50_000_000)
      .default(5_000_000),
    AI_PROVIDER: z
      .enum(["disabled", "openai", "gemini"])
      .default("disabled"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).default("gpt-5.6-sol"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GOOGLE_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
    AI_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(60_000),
    AI_CACHE_TTL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(300_000),
    AI_CACHE_MAX_ENTRIES: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_000)
      .default(100),
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
