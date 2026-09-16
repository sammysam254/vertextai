// ==============================================
// Database Service Exports
// ==============================================

// Organization services
export {
  getOrganizationByPhone,
  getOrganizationById,
  updateOrganization,
  listOrganizations,
  getMerchantCode,
  getOrganizationByMerchantCode,
  generateUniqueMerchantCode,
  ensureOrganizationMerchantCode,
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
  reapStaleCommunications,
} from './communication.service';

// Message services
export {
  createMessage,
  getMessageThread,
  listRecentMessages,
} from './message.service';

// Agent services
export {
  createAgent,
  getAgentById,
  getAgentByPhone,
  listOrganizationAgents,
  updateAgentStatus,
  updateAgent,
  deleteAgent,
  getAvailableAgents,
  findOrCreateAgent,
} from './agent.service';
