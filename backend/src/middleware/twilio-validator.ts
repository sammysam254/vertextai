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
  const signature = request.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn(
      { url: request.url, ip: request.ip },
      'Missing Twilio signature header'
    );
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Missing X-Twilio-Signature header',
    });
  }

  try {
    // Use organization-specific auth token if provided, otherwise fallback
    const token = authToken || config.twilioAuthToken;

    if (!token) {
      logger.error('No Twilio auth token available for validation');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Server configuration error',
      });
    }

    // Construct URL (must match exactly what Twilio used)
    const protocol = request.headers['x-forwarded-proto'] || 'https';
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    const url = `${protocol}://${host}${request.url}`;

    // Get request params (form-encoded for voice/SMS webhooks)
    const params = request.body as Record<string, string>;

    // Compute expected signature
    const expectedSignature = computeTwilioSignature(url, params, token);

    // Compare signatures (constant-time comparison)
    if (!timingSafeEqual(signature, expectedSignature)) {
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

    logger.debug({ url: request.url }, 'Twilio signature validated successfully');
  } catch (error) {
    logger.error({ error, url: request.url }, 'Error validating Twilio signature');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Signature validation error',
    });
  }
}

/**
 * Compute Twilio signature
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
function computeTwilioSignature(
  url: string,
  params: Record<string, string>,
  authToken: string
): string {
  // Sort params by key
  const sortedKeys = Object.keys(params).sort();

  // Concatenate URL with sorted params
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // Compute HMAC-SHA256
  const hmac = createHmac('sha256', authToken);
  hmac.update(data);

  // Return base64-encoded signature
  return hmac.digest('base64');
}

/**
 * Timing-safe string comparison (prevents timing attacks)
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
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
    // Skip validation in development if explicitly disabled
    if (
      config.nodeEnv === 'development' &&
      process.env.SKIP_TWILIO_VALIDATION === 'true'
    ) {
      logger.warn('Twilio signature validation SKIPPED (development mode)');
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
