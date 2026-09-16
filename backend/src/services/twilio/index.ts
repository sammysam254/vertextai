// ==============================================
// Twilio Service Exports
// ==============================================

// TwiML generators
export {
  generateGreetingTwiML,
  generateTurnTwiML,
  generateEscalationTwiML,
  generateTransferTwiML,
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
  searchAvailablePhoneNumbers,
  purchasePhoneNumber,
} from './client.service';
