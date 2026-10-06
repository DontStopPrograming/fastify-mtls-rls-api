import { z } from 'zod';

const EnvSchema = z.object({
    PORT: z.string().default(`3000`),
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;