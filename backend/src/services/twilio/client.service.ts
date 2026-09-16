// ==============================================
// Twilio REST API Client Service
// ==============================================

import twilio from 'twilio';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { ExternalServiceError } from '@/middleware';

const logger = createLogger('twilio:client');

// ==============================================
// Create Twilio Client
// ==============================================

/**
 * Create Twilio client for organization
 * Uses org-specific credentials if provided, otherwise fallback
 */
export function createTwilioClient(params?: {
  accountSid?: string;
  authToken?: string;
}): twilio.Twilio {
  const accountSid = params?.accountSid || config.twilioAccountSid;
  const authToken = params?.authToken || config.twilioAuthToken;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(accountSid, authToken);
}

// ==============================================
// Outbound Calling
// ==============================================

/**
 * Initiate outbound call
 */
export async function initiateOutboundCall(params: {
  to: string;
  from: string;
  url: string;
  statusCallback?: string;
  accountSid?: string;
  authToken?: string;
}): Promise<{ callSid: string; status: string }> {
  const { to, from, url, statusCallback, accountSid, authToken } = params;

  try {
    const client = createTwilioClient({ accountSid, authToken });

    logger.info({ to, from }, 'Initiating outbound call');

    const call = await client.calls.create({
      to,
      from,
      url,
      statusCallback,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer'],
    });

    logger.info({ callSid: call.sid, status: call.status }, 'Outbound call initiated');

    return {
      callSid: call.sid,
      status: call.status,
    };
  } catch (error: any) {
    logger.error({ error, to, from }, 'Error initiating outbound call');
    throw new ExternalServiceError('Twilio', error?.message || 'Failed to initiate call');
  }
}

/**
 * Update call in progress (redirect, modify)
 */
export async function updateCall(params: {
  callSid: string;
  url?: string;
  status?: 'canceled' | 'completed';
  accountSid?: string;
  authToken?: string;
}): Promise<void> {
  const { callSid, url, status, accountSid, authToken } = params;

  try {
    const client = createTwilioClient({ accountSid, authToken });

    logger.info({ callSid, url, status }, 'Updating call');

    await client.calls(callSid).update({
      url,
      status,
    });

    logger.info({ callSid }, 'Call updated');
  } catch (error: any) {
    logger.error({ error, callSid }, 'Error updating call');
    throw new ExternalServiceError('Twilio', error?.message || 'Failed to update call');
  }
}

/**
 * Terminate a call immediately (works for in-progress, queued, or ringing calls)
 */
export async function hangupCall(params: {
  callSid: string;
  accountSid?: string;
  authToken?: string;
}): Promise<{ success: boolean; status: string }> {
  const { callSid, accountSid, authToken } = params;

  try {
    const client = createTwilioClient({ accountSid, authToken });
    logger.info({ callSid }, 'Terminating call via Twilio REST API');

    // Attempt to complete (in-progress call)
    try {
      const call = await client.calls(callSid).update({ status: 'completed' });
      logger.info({ callSid, status: call.status }, 'Call successfully completed/hung up');
      return { success: true, status: call.status };
    } catch (completedErr: any) {
      // If ringing or queued, 'completed' is invalid; try 'canceled'
      try {
        const call = await client.calls(callSid).update({ status: 'canceled' });
        logger.info({ callSid, status: call.status }, 'Call successfully canceled/hung up');
        return { success: true, status: call.status };
      } catch (canceledErr: any) {
        logger.info(
          { callSid, msg: canceledErr?.message || completedErr?.message },
          'Call might already be ended or terminal'
        );
        return { success: true, status: 'completed' };
      }
    }
  } catch (error: any) {
    logger.warn({ error: error?.message, callSid }, 'Note during call hangup request');
    return { success: true, status: 'completed' };
  }
}

// ==============================================
// SMS Messaging
// ==============================================

/**
 * Send outbound SMS
 */
export async function sendSMS(params: {
  to: string;
  from: string;
  body: string;
  statusCallback?: string;
  accountSid?: string;
  authToken?: string;
}): Promise<{ messageSid: string; status: string }> {
  const { to, from, body, statusCallback, accountSid, authToken } = params;

  try {
    const client = createTwilioClient({ accountSid, authToken });

    logger.info({ to, from, bodyLength: body.length }, 'Sending SMS');

    const message = await client.messages.create({
      to,
      from,
      body,
      statusCallback,
    });

    logger.info({ messageSid: message.sid, status: message.status }, 'SMS sent');

    return {
      messageSid: message.sid,
      status: message.status,
    };
  } catch (error: any) {
    logger.error({ error, to, from }, 'Error sending SMS');
    throw new ExternalServiceError('Twilio', error?.message || 'Failed to send SMS');
  }
}

// ==============================================
// Fetch Call/Message Details
// ==============================================

/**
 * Get call details from Twilio
 */
export async function getCallDetails(params: {
  callSid: string;
  accountSid?: string;
  authToken?: string;
}): Promise<any> {
  const { callSid, accountSid, authToken } = params;

  try {
    const client = createTwilioClient({ accountSid, authToken });

    const call = await client.calls(callSid).fetch();

    return {
      sid: call.sid,
      status: call.status,
      duration: call.duration,
      price: call.price,
      direction: call.direction,
    };
  } catch (error) {
    logger.error({ error, callSid }, 'Error fetching call details');
    throw new ExternalServiceError('Twilio', 'Failed to fetch call details');
  }
}

/**
 * Get message details from Twilio
 */
export async function getMessageDetails(params: {
  messageSid: string;
  accountSid?: string;
  authToken?: string;
}): Promise<any> {
  const { messageSid, accountSid, authToken } = params;

  try {
    const client = createTwilioClient({ accountSid, authToken });

    const message = await client.messages(messageSid).fetch();

    return {
      sid: message.sid,
      status: message.status,
      price: message.price,
      direction: message.direction,
      numSegments: message.numSegments,
    };
  } catch (error) {
    logger.error({ error, messageSid }, 'Error fetching message details');
    throw new ExternalServiceError('Twilio', 'Failed to fetch message details');
  }
}
