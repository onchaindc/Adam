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
