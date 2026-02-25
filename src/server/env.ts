import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AI_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): ServerEnv {
  return envSchema.parse(input);
}

export function getServerEnv(): ServerEnv {
  return parseEnv(process.env as Record<string, unknown>);
}
