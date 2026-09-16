// ==============================================
// Configuration Management
// ==============================================

import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(5050),
  baseUrl: z.string().url().default('http://localhost:5050'),

  // Supabase
  supabaseUrl: z.string().url(),
  supabaseServiceRoleKey: z.string().min(1),

  // Redis
  redisHost: z.string().optional(),
  redisPort: z.coerce.number().optional(),
  redisPassword: z.string().optional(),
  redisUrl: z.string().optional(),

  // Twilio (fallback credentials)
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),

  // Groq AI
  groqApiKey: z.string().min(1),
  groqModel: z.string().default('llama-3.1-8b-instant'),

  // OpenAI (optional fallback)
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().default('gpt-4o-mini'),

  // ElevenLabs (optional)
  elevenlabsApiKey: z.string().optional(),

  // Security
  jwtSecret: z.string().min(32),

  // Rate Limiting
  rateLimitMax: z.coerce.number().default(100),
  rateLimitWindowMs: z.coerce.number().default(60000),

  // Cache TTL (seconds)
  cacheOrgTtl: z.coerce.number().default(86400), // 24 hours
  cacheCallTtl: z.coerce.number().default(7200), // 2 hours
  cacheSmsTtl: z.coerce.number().default(3600), // 1 hour

  // Logging
  logLevel: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  maskPiiInLogs: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const rawConfig = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    baseUrl:
      process.env.BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://vertext.site' : 'https://vertext.site'),

    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    redisHost: process.env.REDIS_HOST,
    redisPort: process.env.REDIS_PORT,
    redisPassword: process.env.REDIS_PASSWORD,
    redisUrl: process.env.REDIS_URL,

    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708',

    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL,

    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,

    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,

    jwtSecret: process.env.JWT_SECRET,

    rateLimitMax: process.env.RATE_LIMIT_MAX,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,

    cacheOrgTtl: process.env.CACHE_ORG_TTL,
    cacheCallTtl: process.env.CACHE_CALL_TTL,
    cacheSmsTtl: process.env.CACHE_SMS_TTL,

    logLevel: process.env.LOG_LEVEL,
    maskPiiInLogs: process.env.MASK_PII_IN_LOGS,
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();

// Helper to mask PII in logs
export function maskPhone(phone: string): string {
  if (!config.maskPiiInLogs) return phone;
  if (phone.length < 4) return '***';
  return `***${phone.slice(-4)}`;
}

export function maskEmail(email: string): string {
  if (!config.maskPiiInLogs) return email;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
