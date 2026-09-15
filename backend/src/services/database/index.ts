// ==============================================
// Database Service Exports
// ==============================================

// Organization services
export {
  getOrganizationByPhone,
  getOrganizationById,
  updateOrganization,
  listOrganizations,
} from './organization.service';

// Contact services
export {
  findOrCreateContact,
  getContactById,
  getContactByPhone,
  updateContact,
  listContacts,
  deleteContact,
} from './contact.service';

// Communication services
export {
  createCommunication,
  getCommunicationById,
  getCommunicationByTwilioSid,
  updateCommunication,
  listCommunications,
  saveTranscriptTurn,
  getFullTranscript,
} from './communication.service';

// Message services
export {
  createMessage,
  getMessageThread,
  listRecentMessages,
} from './message.service';
