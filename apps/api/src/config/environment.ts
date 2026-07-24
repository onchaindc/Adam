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
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
