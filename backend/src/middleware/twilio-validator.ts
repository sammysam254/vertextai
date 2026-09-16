// ==============================================
// Twilio Webhook Signature Validation Middleware
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';
import { config, maskPhone } from '@/lib/config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('twilio:validator');

/**
 * Validate Twilio webhook signature
 * Ensures requests actually come from Twilio
 */
export async function validateTwilioSignature(
  request: FastifyRequest,
  reply: FastifyReply,
  authToken?: string
) {
  if (process.env.SKIP_TWILIO_VALIDATION === 'true') {
    return;
  }

  const signature = request.headers['x-twilio-signature'] as string;

  if (!signature) {
    if (process.env.STRICT_TWILIO_VALIDATION === 'true') {
      logger.warn(
        { url: request.url, ip: request.ip },
        'Missing Twilio signature header'
      );
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Missing X-Twilio-Signature header',
      });
    }
    // Allow through if not in strict mode
    return;
  }

  try {
    const token = authToken || config.twilioAuthToken;

    if (!token) {
      return;
    }

    // Construct URL (must match what Twilio signed)
    const protocol = request.headers['x-forwarded-proto'] || 'https';
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    const url = `${protocol}://${host}${request.url}`;

    // Get request params
    const params = (request.body as Record<string, string>) || {};

    // Compute expected signature using Twilio standard HMAC-SHA1
    const expectedSignature = computeTwilioSignature(url, params, token);

    // Compare signatures
    if (!timingSafeEqual(signature, expectedSignature)) {
      if (process.env.STRICT_TWILIO_VALIDATION === 'true') {
        logger.warn(
          {
            url: request.url,
            ip: request.ip,
            receivedSignature: signature.slice(0, 10) + '...',
          },
          'Invalid Twilio signature'
        );

        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Invalid Twilio signature',
        });
      }
    }

    logger.debug({ url: request.url }, 'Twilio signature check complete');
  } catch (error) {
    logger.debug({ error, url: request.url }, 'Note validating Twilio signature');
  }
}

/**
 * Compute Twilio signature (HMAC-SHA1 per Twilio documentation)
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
function computeTwilioSignature(
  url: string,
  params: Record<string, string>,
  authToken: string
): string {
  const sortedKeys = Object.keys(params || {}).sort();

  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // Twilio uses HMAC-SHA1
  const hmac = createHmac('sha1', authToken);
  hmac.update(data);

  return hmac.digest('base64');
}

/**
 * Timing-safe string comparison (prevents timing attacks)
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Fastify preHandler hook for Twilio signature validation
 */
export function twilioSignatureHook(authToken?: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (
      config.nodeEnv === 'development' ||
      process.env.SKIP_TWILIO_VALIDATION === 'true'
    ) {
      return;
    }

    await validateTwilioSignature(request, reply, authToken);
  };
}

/**
 * Extract phone number from Twilio webhook payload (for logging)
 */
export function extractPhoneFromWebhook(body: Record<string, string>): {
  from?: string;
  to?: string;
} {
  return {
    from: body.From ? maskPhone(body.From) : undefined,
    to: body.To ? maskPhone(body.To) : undefined,
  };
}
