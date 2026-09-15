// ==============================================
// TwiML Generation Service
// ==============================================

import { createLogger } from '@/lib/logger';

const logger = createLogger('twilio:twiml');

// ==============================================
// Helper: Escape XML
// ==============================================

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ==============================================
// Voice TwiML Generators
// ==============================================

/**
 * Generate greeting TwiML with <Gather>
 */
export function generateGreetingTwiML(params: {
  greetingMessage: string;
  voiceId: string;
  turnUrl: string;
}): string {
  const { greetingMessage, voiceId, turnUrl } = params;

  logger.debug({ voiceId }, 'Generating greeting TwiML');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${escapeXml(turnUrl)}" input="speech dtmf" method="POST" speechTimeout="auto" timeout="5" numDigits="1">
    <Say voice="${escapeXml(voiceId)}">${escapeXml(greetingMessage)}</Say>
  </Gather>
  <Redirect>${escapeXml(turnUrl)}</Redirect>
</Response>`;
}

/**
 * Generate turn-based conversation TwiML
 */
export function generateTurnTwiML(params: {
  aiReply: string;
  voiceId: string;
  turnUrl: string;
  shouldPromptEscalation?: boolean;
}): string {
  const { aiReply, voiceId, turnUrl, shouldPromptEscalation = false } = params;

  logger.debug({ replyLength: aiReply.length }, 'Generating turn TwiML');

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${escapeXml(turnUrl)}" input="speech dtmf" method="POST" speechTimeout="auto" timeout="5" numDigits="1">
    <Say voice="${escapeXml(voiceId)}">${escapeXml(aiReply)}</Say>`;

  if (shouldPromptEscalation) {
    twiml += `
    <Say voice="${escapeXml(voiceId)}">If you'd like to speak with a human agent, press 0 or say agent.</Say>`;
  }

  twiml += `
  </Gather>
  <Redirect>${escapeXml(turnUrl)}</Redirect>
</Response>`;

  return twiml;
}

/**
 * Generate escalation TwiML (transfer to human)
 */
export function generateEscalationTwiML(params: {
  escalationNumber: string;
  voiceId: string;
  statusUrl: string;
}): string {
  const { escalationNumber, voiceId, statusUrl } = params;

  logger.info({ escalationNumber }, 'Generating escalation TwiML');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voiceId)}">Please hold while I connect you to an available agent.</Say>
  <Dial timeout="30" action="${escapeXml(statusUrl)}">
    ${escapeXml(escalationNumber)}
  </Dial>
  <Say voice="${escapeXml(voiceId)}">I'm sorry, all agents are currently busy. Please call back later.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate error TwiML (fallback)
 */
export function generateErrorTwiML(params: {
  voiceId: string;
  errorMessage?: string;
}): string {
  const { voiceId, errorMessage = 'An error occurred. Please try again later.' } = params;

  logger.warn('Generating error TwiML');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voiceId)}">${escapeXml(errorMessage)}</Say>
  <Hangup/>
</Response>`;
}

// ==============================================
// SMS TwiML Generators
// ==============================================

/**
 * Generate SMS reply TwiML
 */
export function generateSMSReplyTwiML(params: {
  replyMessage: string;
}): string {
  const { replyMessage } = params;

  logger.debug({ messageLength: replyMessage.length }, 'Generating SMS reply TwiML');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(replyMessage)}</Message>
</Response>`;
}

/**
 * Generate empty SMS TwiML (no reply)
 */
export function generateEmptySMSTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response/>`;
}
