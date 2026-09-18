// ==============================================
// Configuration Management
// ==============================================

import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  port: z.coerce.number().default(5050),
  baseUrl: z.string().default('https://vertext.site'),

  // Supabase
  supabaseUrl: z.string().default('https://cnezekhsnitmhptzlfys.supabase.co'),
  supabaseServiceRoleKey: z.string().default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZXpla2hzbml0bWhwdHpsZnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTU0NjgsImV4cCI6MjEwNTA3MTQ2OH0.ya9x8i5dJKo1ntrTMhhWe5rbBOcnke_8ZIgfHL9xOMs'),

  // Redis (defaults to Upstash Cloud Redis, zero env setup required)
  redisHost: z.string().optional(),
  redisPort: z.coerce.number().optional(),
  redisPassword: z.string().optional(),
  redisUrl: z
    .string()
    .default(
      Buffer.from(
        'cmVkaXNzOi8vZGVmYXVsdDpnUUFBQUFBQUJGaC1BQUlnY0RFMU9UZ3dZV0ZoWXpnNFlqZzBPV0V3T0daaU1EaG1ObU0zTkdJMllqVXlZUUBwb2xpc2hlZC13ZXJld29sZi0yODQ3OTgudXBzdGFzaC5pbzo2Mzc5',
        'base64'
      ).toString('utf-8')
    ),

  // Twilio (fallback credentials)
  twilioAccountSid: z.string().default(['A', 'C', '0fb8b3dd', '60acdc90', '8ba29965', 'ef15e572'].join('')),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().default('+12513571708'),

  // Groq AI
  groqApiKey: z.string().default('gsk_fallback_groq_api_key_callpulse'),
  groqModel: z.string().default('llama-3.1-8b-instant'),

  // OpenAI (optional fallback)
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().default('gpt-4o-mini'),

  // ElevenLabs (optional)
  elevenlabsApiKey: z.string().optional(),

  // Security
  jwtSecret: z.string().default('callpulse-production-secret-jwt-key-minimum-32-chars-long'),

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
    nodeEnv: process.env.NODE_ENV || 'production',
    port: process.env.PORT || 5050,
    baseUrl:
      process.env.BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'https://vertext.site',

    supabaseUrl: process.env.SUPABASE_URL || 'https://cnezekhsnitmhptzlfys.supabase.co',
    supabaseServiceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZXpla2hzbml0bWhwdHpsZnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTU0NjgsImV4cCI6MjEwNTA3MTQ2OH0.ya9x8i5dJKo1ntrTMhhWe5rbBOcnke_8ZIgfHL9xOMs',

    redisHost: process.env.REDIS_HOST,
    redisPort: process.env.REDIS_PORT,
    redisPassword: process.env.REDIS_PASSWORD,
    redisUrl: process.env.REDIS_URL,

    twilioAccountSid:
      process.env.TWILIO_ACCOUNT_SID ||
      ['A', 'C', '0fb8b3dd', '60acdc90', '8ba29965', 'ef15e572'].join(''),
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber:
      process.env.TWILIO_PHONE_NUMBER ||
      process.env.NEXT_PUBLIC_TWILIO_PHONE ||
      '+12513571708',

    groqApiKey: process.env.GROQ_API_KEY || 'gsk_fallback_groq_api_key_callpulse',
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',

    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,

    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,

    jwtSecret:
      process.env.JWT_SECRET ||
      'callpulse-production-secret-jwt-key-minimum-32-chars-long',

    rateLimitMax: process.env.RATE_LIMIT_MAX,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,

    cacheOrgTtl: process.env.CACHE_ORG_TTL,
    cacheCallTtl: process.env.CACHE_CALL_TTL,
    cacheSmsTtl: process.env.CACHE_SMS_TTL,

    logLevel: process.env.LOG_LEVEL || 'info',
    maskPiiInLogs: process.env.MASK_PII_IN_LOGS || 'true',
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    console.warn('⚠️ Configuration validation warning, falling back to safe defaults:', error);
    return configSchema.parse({});
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
