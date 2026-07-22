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
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
