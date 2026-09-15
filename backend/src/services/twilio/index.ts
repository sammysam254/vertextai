// ==============================================
// Twilio Service Exports
// ==============================================

// TwiML generators
export {
  generateGreetingTwiML,
  generateTurnTwiML,
  generateEscalationTwiML,
  generateErrorTwiML,
  generateSMSReplyTwiML,
  generateEmptySMSTwiML,
} from './twiml.service';

// REST API client
export {
  createTwilioClient,
  initiateOutboundCall,
  updateCall,
  sendSMS,
  getCallDetails,
  getMessageDetails,
} from './client.service';
