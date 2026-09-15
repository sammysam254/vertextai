// ==============================================
// TypeScript Type Definitions
// ==============================================

export type UserRole = 'owner' | 'admin' | 'agent' | 'viewer';

export type CommunicationType = 'voice' | 'sms';

export type CommunicationStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'canceled';

export type MessageSender = 'customer' | 'agent' | 'ai';

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'read';

export type CallDirection = 'inbound' | 'outbound';

// Database types
export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string;
  ai_system_prompt: string;
  ai_model: string;
  ai_temperature: number;
  escalation_phone_number: string | null;
  escalation_keywords: string[];
  voice_model: string;
  elevenlabs_voice_id: string | null;
  business_hours: Record<string, any> | null;
  metadata: Record<string, any> | null;
}

export interface Contact {
  id: string;
  organization_id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
  total_interactions: number;
  metadata: Record<string, any> | null;
}

export interface Communication {
  id: string;
  organization_id: string;
  contact_id: string | null;
  type: CommunicationType;
  direction: CallDirection;
  status: CommunicationStatus;
  twilio_sid: string;
  from_number: string;
  to_number: string;
  duration_seconds: number | null;
  recording_url: string | null;
  escalated_at: string | null;
  escalated_to_phone: string | null;
  escalated_call_sid: string | null;
  ai_summary: string | null;
  sentiment_score: number | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export interface Message {
  id: string;
  communication_id: string;
  organization_id: string;
  sender: MessageSender;
  body: string;
  status: MessageStatus;
  created_at: string;
}

export interface CallTranscript {
  id: string;
  communication_id: string;
  speaker: 'customer' | 'ai' | 'agent';
  content: string;
  timestamp: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

// Dashboard metrics types
export interface DashboardMetrics {
  queueWaitingTime: number; // seconds
  lostCallsRate: number; // percentage
  lostCallsChange: number; // count change
  liveServiceLevel: number; // percentage
  serviceLevelGoal: number; // percentage
  activeCalls: number;
  waitingCalls: number;
}

export interface QueueStatus {
  name: string;
  status: 'in-call' | 'available' | 'offline';
  count: number;
}

export interface AgentPerformance {
  id: string;
  name: string;
  avatar: string | null;
  status: 'available' | 'in-call' | 'offline';
  callsToday: number;
  completionRate: number; // percentage
}

export interface PerformanceDataPoint {
  time: string;
  incoming: number;
  waiting: number;
  resolved: number;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  email: string;
  password: string;
  organizationName: string;
  phoneNumber: string;
}

export interface ContactForm {
  name: string;
  phone_number: string;
  email?: string;
  metadata?: Record<string, any>;
}

export interface SettingsAIForm {
  ai_system_prompt: string;
  ai_model: string;
  ai_temperature: number;
}

export interface SettingsVoiceForm {
  voice_model: string;
  elevenlabs_voice_id?: string;
}

export interface SettingsTwilioForm {
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
}

export interface SettingsEscalationForm {
  escalation_phone_number: string;
  escalation_keywords: string[];
}

// Filter types
export interface CommunicationFilters {
  type?: CommunicationType;
  status?: CommunicationStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ContactFilters {
  search?: string;
  page?: number;
  per_page?: number;
}
