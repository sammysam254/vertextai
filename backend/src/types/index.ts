// ==============================================
// CallPulse Type Definitions
// ==============================================

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string;
  ai_system_prompt: string;
  ai_voice_id: string;
  ai_model: string;
  escalation_phone_number: string;
  escalation_keywords: string[];
  subscription_tier: 'free' | 'pro' | 'enterprise';
  metadata: Record<string, unknown>;
}

export interface Contact {
  id: string;
  organization_id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
}

export interface Communication {
  id: string;
  organization_id: string;
  contact_id: string | null;
  type: 'voice_in' | 'voice_out' | 'sms_in' | 'sms_out';
  twilio_sid: string;
  from_number: string;
  to_number: string;
  status: string;
  duration_seconds: number;
  escalated_to_human: boolean;
  escalation_reason: string | null;
  escalation_timestamp: string | null;
  transferred_to_agent_id: string | null;
  transferred_at: string | null;
  transfer_status: 'pending' | 'completed' | 'failed' | 'busy' | 'no_answer' | null;
  summary: string | null;
  sentiment: string | null;
  intent: string | null;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Message {
  id: string;
  organization_id: string;
  communication_id: string;
  sender: 'customer' | 'ai' | 'agent';
  body: string;
  media_urls: string[] | null;
  created_at: string;
}

export interface CallTranscript {
  id: string;
  communication_id: string;
  speaker: 'caller' | 'ai' | 'agent';
  content: string;
  confidence: number | null;
  timestamp: string;
}

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  status: 'available' | 'in_call' | 'busy' | 'offline';
  is_active: boolean;
  user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_status_change_at: string;
}

// ==============================================
// Twilio Webhook Types
// ==============================================

export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer';
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  ApiVersion: string;
  // Speech recognition results (from <Gather>)
  SpeechResult?: string;
  Confidence?: string;
  // DTMF digits
  Digits?: string;
}

export interface TwilioSMSWebhook {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export interface TwilioStatusCallback {
  CallSid: string;
  CallStatus: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
}

// ==============================================
// AI Service Types
// ==============================================

export interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIReplyResult {
  reply: string;
  shouldEscalate: boolean;
  reason?: string;
  confidence?: number;
}

export interface CallState {
  organizationId: string;
  contactId: string;
  communicationId: string;
  conversationContext: ConversationTurn[];
  turnCount: number;
  startTime: number;
}

export interface SMSContext {
  messages: Array<{
    sender: 'customer' | 'ai';
    body: string;
    timestamp: number;
  }>;
  lastMessageAt: number;
}

// ==============================================
// Cache Types
// ==============================================

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
}

// ==============================================
// API Request/Response Types
// ==============================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    redis: { status: 'up' | 'down'; latency?: number };
    database: { status: 'up' | 'down'; latency?: number };
    twilio: { status: 'up' | 'down' };
  };
  cache: CacheMetrics;
}

export interface DispatchCallRequest {
  to: string;
  from: string;
  organizationId: string;
  context?: string;
}

export interface DispatchCallResponse {
  callSid: string;
  status: string;
  communicationId: string;
}

export interface SendSMSRequest {
  to: string;
  from: string;
  organizationId: string;
  body: string;
}

export interface ListCommunicationsQuery {
  organizationId: string;
  type?: Communication['type'];
  status?: string;
  escalated?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface TransferCallRequest {
  callSid: string;
  agentPhoneNumber?: string;
  agentId?: string;
  organizationId: string;
}

export interface TransferCallResponse {
  success: boolean;
  message: string;
  transferredAt: string;
  agentId?: string;
}
