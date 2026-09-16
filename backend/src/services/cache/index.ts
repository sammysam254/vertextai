// ==============================================
// Cache Service Exports
// ==============================================

// Organization caching
export {
  getCachedOrganizationByPhone,
  getCachedOrganizationById,
  setOrganizationCache,
  invalidateOrganizationCache,
  invalidateAllOrganizations,
  warmOrganizationCache,
} from './organization.cache';

// Call state caching
export {
  getCallState,
  initializeCallState,
  setCallState,
  appendCallTurn,
  clearCallState,
  getCallDuration,
  isCallActive,
  setCallLatestStatus,
  getCallLatestStatus,
} from './call.cache';

// SMS context caching
export {
  getSMSContext,
  initializeSMSContext,
  setSMSContext,
  appendSMSMessage,
  clearSMSContext,
  getRecentSMSMessages,
  isSMSConversationActive,
} from './sms.cache';
