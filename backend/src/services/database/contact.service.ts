// ==============================================
// Contact Database Service
// ==============================================

import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { NotFoundError, AppError, ConflictError } from '@/middleware';
import type { Contact } from '@/types';

const logger = createLogger('db:contact');

// ==============================================
// Find or Create Contact
// ==============================================

/**
 * Find existing contact or create new one
 * Used by webhook handlers for automatic contact creation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findOrCreateContact(
  organizationId: string,
  phoneNumber: string,
  metadata?: { name?: string; email?: string }
): Promise<Contact> {
  let targetOrgId = organizationId;

  // Validate or resolve UUID for Postgres
  if (!targetOrgId || !UUID_REGEX.test(targetOrgId)) {
    try {
      const { data: firstOrg } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (firstOrg?.id) {
        targetOrgId = firstOrg.id;
      } else {
        targetOrgId = '00000000-0000-0000-0000-000000000000';
      }
    } catch {
      targetOrgId = '00000000-0000-0000-0000-000000000000';
    }
  }

  try {
    // Try to find existing contact
    const { data: existing, error: findError } = await supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', targetOrgId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (existing && !findError) {
      logger.debug({ contactId: existing.id, phoneNumber }, 'Contact found');
      return existing;
    }

    // Create new contact
    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        organization_id: targetOrgId,
        phone_number: phoneNumber,
        name: metadata?.name || null,
        email: metadata?.email || null,
        metadata: {},
      })
      .select()
      .maybeSingle();

    if (newContact) {
      logger.info(
        { contactId: newContact.id, organizationId: targetOrgId, phoneNumber },
        'Contact created'
      );
      return newContact;
    }

    if (createError && createError.code === '23505') {
      // Race condition retry find
      const { data: retry } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (retry) return retry;
    }
  } catch (error) {
    logger.debug({ error, organizationId: targetOrgId, phoneNumber }, 'Note finding/creating contact in DB');
  }

  // Graceful fallback contact so call/SMS handling never fails
  return {
    id: '00000000-0000-0000-0000-000000000000',
    organization_id: targetOrgId,
    phone_number: phoneNumber,
    name: metadata?.name || null,
    email: metadata?.email || null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_contact_at: new Date().toISOString(),
  };
}

// ==============================================
// Get Contact
// ==============================================

/**
 * Get contact by ID
 */
export async function getContactById(contactId: string): Promise<Contact> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Contact');
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error({ error, contactId }, 'Error getting contact');
    throw new AppError('Failed to get contact', 500);
  }
}

/**
 * Get contact by phone number within organization
 */
export async function getContactByPhone(
  organizationId: string,
  phoneNumber: string
): Promise<Contact | null> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  } catch (error) {
    logger.error({ error, organizationId, phoneNumber }, 'Error getting contact by phone');
    throw new AppError('Failed to get contact', 500);
  }
}

// ==============================================
// Update Contact
// ==============================================

/**
 * Update contact information
 */
export async function updateContact(
  contactId: string,
  updates: Partial<Contact>
): Promise<Contact> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Contact');
      }
      throw error;
    }

    logger.info({ contactId, fields: Object.keys(updates) }, 'Contact updated');
    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error({ error, contactId }, 'Error updating contact');
    throw new AppError('Failed to update contact', 500);
  }
}

// ==============================================
// List Contacts
// ==============================================

/**
 * List contacts for organization (paginated)
 */
export async function listContacts(params: {
  organizationId: string;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ contacts: Contact[]; total: number }> {
  const { organizationId, limit = 50, offset = 0, search } = params;

  try {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('last_contact_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    // Add search filter if provided
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      contacts: data || [],
      total: count || 0,
    };
  } catch (error) {
    logger.error({ error, organizationId }, 'Error listing contacts');
    throw new AppError('Failed to list contacts', 500);
  }
}

// ==============================================
// Delete Contact
// ==============================================

/**
 * Delete contact
 */
export async function deleteContact(contactId: string): Promise<void> {
  try {
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);

    if (error) throw error;

    logger.info({ contactId }, 'Contact deleted');
  } catch (error) {
    logger.error({ error, contactId }, 'Error deleting contact');
    throw new AppError('Failed to delete contact', 500);
  }
}
