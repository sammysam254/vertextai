-- ============================================
-- CallPulse Seed Data (Development/Testing)
-- ============================================

-- This script inserts sample data for local development
-- DO NOT run this in production!

-- ============================================
-- 1. Insert Sample Organizations
-- ============================================

INSERT INTO organizations (
  id,
  name, 
  twilio_phone_number, 
  twilio_account_sid,
  twilio_auth_token,
  escalation_phone_number,
  ai_system_prompt,
  ai_voice_id,
  subscription_tier
) VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Acme Corporation',
  '+15555551234',
  'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'test_auth_token_acme',
  '+15555559999',
  'You are a helpful assistant for Acme Corporation. Assist customers with product inquiries, order status, and general support. Be professional, friendly, and concise.',
  'Polly.Joanna-Neural',
  'pro'
),
(
  'b1ffcc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'TechStart Inc',
  '+15555552345',
  'ACyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  'test_auth_token_techstart',
  '+15555558888',
  'You are a technical support agent for TechStart Inc. Help customers troubleshoot software issues, explain features, and provide documentation links.',
  'Polly.Matthew-Neural',
  'enterprise'
),
(
  'c2ggdd99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'Local Bakery',
  '+15555553456',
  'ACzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'test_auth_token_bakery',
  '+15555557777',
  'You are a friendly assistant for Local Bakery. Help customers with orders, menu questions, store hours, and catering inquiries. Be warm and welcoming.',
  'Polly.Joanna-Neural',
  'free'
);

-- ============================================
-- 2. Insert Sample Contacts
-- ============================================

-- Contacts for Acme Corporation
INSERT INTO contacts (
  organization_id,
  phone_number,
  name,
  email,
  metadata
) VALUES
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '+15551234567',
  'John Smith',
  'john.smith@example.com',
  '{"customer_since": "2024-01-15", "vip": true}'::jsonb
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '+15552345678',
  'Sarah Johnson',
  'sarah.j@example.com',
  '{"customer_since": "2025-03-20", "vip": false}'::jsonb
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '+15553456789',
  'Michael Brown',
  null,
  '{}'::jsonb
);

-- Contacts for TechStart Inc
INSERT INTO contacts (
  organization_id,
  phone_number,
  name,
  email
) VALUES
(
  'b1ffcc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  '+15554567890',
  'Emily Davis',
  'emily.davis@techcorp.com'
),
(
  'b1ffcc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  '+15555678901',
  'David Wilson',
  'david.w@startup.io'
);

-- Contacts for Local Bakery
INSERT INTO contacts (
  organization_id,
  phone_number,
  name
) VALUES
(
  'c2ggdd99-9c0b-4ef8-bb6d-6bb9bd380a33',
  '+15556789012',
  'Lisa Martinez'
);

-- ============================================
-- 3. Insert Sample Communications
-- ============================================

-- Voice calls for Acme Corporation
INSERT INTO communications (
  organization_id,
  contact_id,
  type,
  twilio_sid,
  from_number,
  to_number,
  status,
  duration_seconds,
  escalated_to_human,
  summary,
  sentiment,
  intent,
  completed_at
) VALUES
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM contacts WHERE phone_number = '+15551234567'),
  'voice_in',
  'CA1234567890abcdef1234567890abcdef',
  '+15551234567',
  '+15555551234',
  'completed',
  185,
  false,
  'Customer inquired about order status for order #12345. Provided tracking information and estimated delivery date.',
  'positive',
  'inquiry',
  NOW() - INTERVAL '2 hours'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM contacts WHERE phone_number = '+15552345678'),
  'voice_in',
  'CA2345678901bcdef2345678901bcdef2',
  '+15552345678',
  '+15555551234',
  'completed',
  312,
  true,
  'Customer reported billing issue. Escalated to human agent due to complexity.',
  'negative',
  'complaint',
  NOW() - INTERVAL '1 day'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM contacts WHERE phone_number = '+15553456789'),
  'voice_in',
  'CA3456789012cdef3456789012cdef34',
  '+15553456789',
  '+15555551234',
  'completed',
  92,
  false,
  'Customer asked about product features. Provided detailed information.',
  'neutral',
  'support',
  NOW() - INTERVAL '3 hours'
);

-- SMS messages for Acme Corporation
INSERT INTO communications (
  organization_id,
  contact_id,
  type,
  twilio_sid,
  from_number,
  to_number,
  status,
  summary,
  sentiment,
  completed_at
) VALUES
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM contacts WHERE phone_number = '+15551234567'),
  'sms_in',
  'SM1234567890abcdef1234567890abcdef',
  '+15551234567',
  '+15555551234',
  'completed',
  'Customer confirmed receipt of order.',
  'positive',
  NOW() - INTERVAL '30 minutes'
);

-- Communications for TechStart Inc
INSERT INTO communications (
  organization_id,
  contact_id,
  type,
  twilio_sid,
  from_number,
  to_number,
  status,
  duration_seconds,
  summary,
  sentiment,
  completed_at
) VALUES
(
  'b1ffcc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  (SELECT id FROM contacts WHERE phone_number = '+15554567890' LIMIT 1),
  'voice_in',
  'CA4567890123def4567890123def4567',
  '+15554567890',
  '+15555552345',
  'completed',
  245,
  'Technical support for software installation issue. Resolved successfully.',
  'positive',
  NOW() - INTERVAL '5 hours'
);

-- ============================================
-- 4. Insert Sample Messages (SMS threads)
-- ============================================

-- SMS thread for John Smith
INSERT INTO messages (
  organization_id,
  communication_id,
  sender,
  body,
  created_at
) VALUES
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM communications WHERE twilio_sid = 'SM1234567890abcdef1234567890abcdef'),
  'customer',
  'Hi, did my order ship yet?',
  NOW() - INTERVAL '35 minutes'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM communications WHERE twilio_sid = 'SM1234567890abcdef1234567890abcdef'),
  'ai',
  'Hello! Yes, your order #12345 shipped yesterday and is currently in transit. You should receive it within 2-3 business days. Would you like the tracking number?',
  NOW() - INTERVAL '34 minutes'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM communications WHERE twilio_sid = 'SM1234567890abcdef1234567890abcdef'),
  'customer',
  'Yes please!',
  NOW() - INTERVAL '32 minutes'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM communications WHERE twilio_sid = 'SM1234567890abcdef1234567890abcdef'),
  'ai',
  'Your tracking number is 1Z999AA10123456784. You can track it at ups.com. Is there anything else I can help you with?',
  NOW() - INTERVAL '31 minutes'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM communications WHERE twilio_sid = 'SM1234567890abcdef1234567890abcdef'),
  'customer',
  'No, that''s perfect. Thanks!',
  NOW() - INTERVAL '30 minutes'
);

-- ============================================
-- 5. Insert Sample Call Transcripts
-- ============================================

-- Transcript for first call (John Smith)
INSERT INTO call_transcripts (
  communication_id,
  speaker,
  content,
  confidence,
  timestamp
) VALUES
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA1234567890abcdef1234567890abcdef'),
  'ai',
  'Hello, you''ve reached Acme Corporation. How can I assist you today?',
  0.98,
  NOW() - INTERVAL '2 hours 3 minutes'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA1234567890abcdef1234567890abcdef'),
  'caller',
  'Hi, I''m calling about my recent order. Can you tell me when it will arrive?',
  0.95,
  NOW() - INTERVAL '2 hours 2 minutes 50 seconds'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA1234567890abcdef1234567890abcdef'),
  'ai',
  'I''d be happy to help you with that. Can you provide your order number?',
  0.97,
  NOW() - INTERVAL '2 hours 2 minutes 40 seconds'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA1234567890abcdef1234567890abcdef'),
  'caller',
  'Yes, it''s order number 12345.',
  0.92,
  NOW() - INTERVAL '2 hours 2 minutes 30 seconds'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA1234567890abcdef1234567890abcdef'),
  'ai',
  'Thank you. I can see that order 12345 shipped yesterday and is currently in transit. The estimated delivery date is tomorrow by end of day. Your tracking number is 1Z999AA10123456784.',
  0.96,
  NOW() - INTERVAL '2 hours 2 minutes 15 seconds'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA1234567890abcdef1234567890abcdef'),
  'caller',
  'Perfect, that''s exactly what I needed to know. Thank you!',
  0.94,
  NOW() - INTERVAL '2 hours 2 minutes'
);

-- Transcript for escalated call (Sarah Johnson)
INSERT INTO call_transcripts (
  communication_id,
  speaker,
  content,
  confidence,
  timestamp
) VALUES
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA2345678901bcdef2345678901bcdef2'),
  'ai',
  'Hello, you''ve reached Acme Corporation. How can I assist you today?',
  0.97,
  NOW() - INTERVAL '1 day 5 minutes'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA2345678901bcdef2345678901bcdef2'),
  'caller',
  'I was charged twice for my last order and I need this fixed immediately.',
  0.89,
  NOW() - INTERVAL '1 day 4 minutes 50 seconds'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA2345678901bcdef2345678901bcdef2'),
  'ai',
  'I sincerely apologize for the billing error. I understand how frustrating that must be. Let me connect you with a specialist who can resolve this for you right away.',
  0.95,
  NOW() - INTERVAL '1 day 4 minutes 35 seconds'
),
(
  (SELECT id FROM communications WHERE twilio_sid = 'CA2345678901bcdef2345678901bcdef2'),
  'ai',
  'Please hold while I connect you to an available agent.',
  0.98,
  NOW() - INTERVAL '1 day 4 minutes 20 seconds'
);

-- ============================================
-- 6. Update Contact Last Contact Dates
-- ============================================

UPDATE contacts 
SET last_contact_at = (
  SELECT MAX(created_at) 
  FROM communications 
  WHERE communications.contact_id = contacts.id
)
WHERE EXISTS (
  SELECT 1 FROM communications WHERE communications.contact_id = contacts.id
);

-- ============================================
-- SEED DATA SUMMARY
-- ============================================

DO $$
DECLARE
  org_count INT;
  contact_count INT;
  comm_count INT;
  message_count INT;
  transcript_count INT;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO contact_count FROM contacts;
  SELECT COUNT(*) INTO comm_count FROM communications;
  SELECT COUNT(*) INTO message_count FROM messages;
  SELECT COUNT(*) INTO transcript_count FROM call_transcripts;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'CallPulse Seed Data Inserted Successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Organizations: %', org_count;
  RAISE NOTICE 'Contacts: %', contact_count;
  RAISE NOTICE 'Communications: %', comm_count;
  RAISE NOTICE 'Messages: %', message_count;
  RAISE NOTICE 'Call Transcripts: %', transcript_count;
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Sample Organization IDs:';
  RAISE NOTICE '  Acme Corporation: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  RAISE NOTICE '  TechStart Inc: b1ffcc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  RAISE NOTICE '  Local Bakery: c2ggdd99-9c0b-4ef8-bb6d-6bb9bd380a33';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Add organization_members to link auth.users';
END $$;
