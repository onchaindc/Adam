import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

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
    PAYMENTS_ENABLED: booleanFromString,
    OKX_API_KEY: z.string().optional(),
    OKX_SECRET_KEY: z.string().optional(),
    OKX_PASSPHRASE: z.string().optional(),
    PAY_TO: z.string().optional(),
    AUDIT_PRICE_USD: z.string().regex(/^\$\d+(\.\d+)?$/).default("$0.01"),
    INVESTIGATE_PRICE_USD: z
      .string()
      .regex(/^\$\d+(\.\d+)?$/)
      .default("$0.01"),
  })
  .superRefine((value, context) => {
    if (!value.PAYMENTS_ENABLED) {
      return;
    }

    const required = [
      "OKX_API_KEY",
      "OKX_SECRET_KEY",
      "OKX_PASSPHRASE",
      "PAY_TO",
    ] as const;

    for (const key of required) {
      if (!value[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when PAYMENTS_ENABLED=true`,
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
