// ==============================================
// Phone Number Formatting & Normalization Utility
// ==============================================

/**
 * Normalizes phone numbers to E.164 format.
 * Supports:
 * - Local Kenyan format: 07XXXXXXXX or 01XXXXXXXX -> +2547XXXXXXXX / +2541XXXXXXXX
 * - Kenyan format without plus: 2547XXXXXXXX or 2541XXXXXXXX -> +2547XXXXXXXX
 * - US/NANP 10-digit format: 2513571708 -> +12513571708 (if not Kenyan/other)
 * - Standard E.164 numbers (+...) with whitespace and symbols stripped
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove whitespace, dashes, parentheses, dots
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned) return '';

  // If already starts with '+', return it
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Handle Kenyan 10-digit local format (07XXXXXXXX or 01XXXXXXXX)
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`;
  }

  // Handle Kenyan 9-digit format (7XXXXXXXX or 1XXXXXXXX)
  if (/^[17]\d{8}$/.test(cleaned)) {
    return `+254${cleaned}`;
  }

  // Handle Kenyan 12-digit format without plus (254XXXXXXXXX)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // International prefix 00 (e.g. 00254...)
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2)}`;
  }

  // Handle 11-digit US format with leading 1 (e.g. 12513571708)
  if (/^1[2-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Handle 10-digit US/Canada format (e.g. 2513571708)
  if (/^[2-9]\d{9}$/.test(cleaned)) {
    return `+1${cleaned}`;
  }

  // Default fallback: prepend +
  return `+${cleaned}`;
}
