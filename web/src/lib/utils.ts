// ==============================================
// Utility Functions
// ==============================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL &&
  !process.env.NEXT_PUBLIC_API_URL.includes('localhost') &&
  !process.env.NEXT_PUBLIC_API_URL.includes('callpulse-api')
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
    : 'https://www.vertext.site';

/**
 * Resolve full backend API URL for client, mobile (Capacitor), and server calls
 */
export function getApiEndpoint(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    // In Capacitor native mobile wrapper, always point to live cloud backend
    const isCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && /Android|iPhone|iPad/i.test(navigator.userAgent))
    );
    if (isCapacitor) {
      return `${BACKEND_API_URL}${cleanPath}`;
    }

    // In standard browser environment (vertext.site, www.vertext.site, Render, localhost):
    // ALWAYS use relative path so requests are strictly same-origin!
    // This completely prevents CORS preflight OPTIONS redirects and "TypeError: Failed to fetch"
    return cleanPath;
  }

  // Server-side rendering (SSR) in Next.js: connect to internal Fastify port
  const internalBackend =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_HOST ||
    'http://127.0.0.1:5050';
  return `${internalBackend.replace(/\/$/, '')}${cleanPath}`;
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/[\s\-\(\)]/g, '');

  const digits = trimmed.replace(/\D/g, '');
  // Kenyan local mobile (07XXXXXXXX or 01XXXXXXXX)
  if (/^0[17]\d{8}$/.test(digits)) {
    return `+254${digits.slice(1)}`;
  }
  // Kenyan with country code but no plus (254XXXXXXXXX)
  if (/^254[17]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }
  // Kenyan 9-digit without leading 0 (7XXXXXXXX or 1XXXXXXXX)
  if (/^[17]\d{8}$/.test(digits)) {
    return `+254${digits}`;
  }
  // US 10-digit
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Mask phone number for display (show last 4 digits)
 */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return '***';
  return `***-***-${phone.slice(-4)}`;
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get relative time string (e.g., "2m ago", "1h ago")
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString();
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
