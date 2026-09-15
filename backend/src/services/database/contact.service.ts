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
export async function findOrCreateContact(
  organizationId: string,
  phoneNumber: string,
  metadata?: { name?: string; email?: string }
): Promise<Contact> {
  try {
    // Try to find existing contact
    const { data: existing, error: findError } = await supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('phone_number', phoneNumber)
      .single();

    if (existing && !findError) {
      logger.debug({ contactId: existing.id, phoneNumber }, 'Contact found');
      return existing;
    }

    // Create new contact
    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        organization_id: organizationId,
        phone_number: phoneNumber,
        name: metadata?.name || null,
        email: metadata?.email || null,
        metadata: {},
      })
      .select()
      .single();

    if (createError) {
      // Handle unique constraint violation (race condition)
      if (createError.code === '23505') {
        // Retry find
        const { data: retry } = await supabase
          .from('contacts')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('phone_number', phoneNumber)
          .single();

        if (retry) return retry;
      }
      throw createError;
    }

    logger.info(
      { contactId: newContact.id, organizationId, phoneNumber },
      'Contact created'
    );
    return newContact;
  } catch (error) {
    logger.error({ error, organizationId, phoneNumber }, 'Error finding/creating contact');
    throw new AppError('Failed to find or create contact', 500);
  }
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
