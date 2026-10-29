/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EnvValidationResult {
  isValid: boolean;
  isDemoMode: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  maskedKey: string;
  host: string;
  error?: string;
  badVariable?: string;
}

/**
 * Sanitizes an environment variable value:
 * - strips whitespace and surrounding quotes
 * - strips accidental variable name prefix (e.g. "VITE_SUPABASE_URL=")
 * - strips trailing slash and /rest/v1 suffix
 */
export function sanitizeEnvValue(val: unknown, prefixToRemove?: string): string {
  if (typeof val !== 'string') return '';
  let cleaned = val.trim();

  // Strip accidental quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Strip variable name if accidentally pasted like "VITE_SUPABASE_URL=https://..."
  if (prefixToRemove && cleaned.toLowerCase().startsWith(prefixToRemove.toLowerCase())) {
    cleaned = cleaned.slice(prefixToRemove.length).trim();
    if (cleaned.startsWith('=')) {
      cleaned = cleaned.slice(1).trim();
    }
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }
  }

  return cleaned;
}

export function sanitizeSupabaseUrl(urlRaw: unknown): { url: string; error?: string } {
  let url = sanitizeEnvValue(urlRaw, 'VITE_SUPABASE_URL');
  if (!url) {
    return { url: '', error: 'VITE_SUPABASE_URL is missing' };
  }

  // Strip trailing /rest/v1 or trailing slash
  url = url.replace(/\/rest\/v1\/?$/, '');
  url = url.replace(/\/+$/, '');

  if (!url.startsWith('https://')) {
    return { url, error: 'VITE_SUPABASE_URL must start with https://' };
  }
  if (!url.endsWith('.supabase.co')) {
    return { url, error: 'VITE_SUPABASE_URL must end with .supabase.co' };
  }

  // Detect placeholder values
  if (
    url.includes('your-project-id') ||
    url.includes('your-project') ||
    url.includes('example.supabase.co') ||
    url.includes('placeholder') ||
    url.includes('<')
  ) {
    return { url: '', error: 'VITE_SUPABASE_URL contains placeholder value' };
  }

  return { url };
}

export function sanitizeSupabaseAnonKey(keyRaw: unknown): { key: string; error?: string } {
  const key = sanitizeEnvValue(keyRaw, 'VITE_SUPABASE_ANON_KEY');
  if (!key) {
    return { key: '', error: 'VITE_SUPABASE_ANON_KEY is missing' };
  }

  // Strict refusal of secret keys
  if (key.startsWith('sb_secret') || key.includes('service_role')) {
    return { key: '', error: 'Secret key detected, use the publishable key (VITE_SUPABASE_ANON_KEY)' };
  }

  // Detect placeholder keys
  if (
    key.includes('your-anon-publishable-key') ||
    key.includes('your-anon-key') ||
    key.includes('your-anon') ||
    key.includes('placeholder') ||
    key.includes('<')
  ) {
    return { key: '', error: 'VITE_SUPABASE_ANON_KEY contains placeholder value' };
  }

  return { key };
}

export function maskKey(key: string): string {
  if (!key) return '(none)';
  if (key.length <= 6) return key;
  return `${key.slice(0, 6)}...`;
}

export function getValidatedConfig(): EnvValidationResult {
  const envObj = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : (typeof process !== 'undefined' ? process.env : {});
  const rawUrl = envObj?.VITE_SUPABASE_URL;
  const rawKey = envObj?.VITE_SUPABASE_ANON_KEY;

  // Check if unconfigured
  if (!rawUrl && !rawKey) {
    return {
      isValid: false,
      isDemoMode: true,
      supabaseUrl: '',
      supabaseAnonKey: '',
      maskedKey: '(none)',
      host: 'local-demo',
      error: 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured.',
      badVariable: 'VITE_SUPABASE_URL',
    };
  }

  const urlResult = sanitizeSupabaseUrl(rawUrl);
  if (urlResult.error) {
    const isPlaceholder = urlResult.error.includes('placeholder') || urlResult.error.includes('missing');
    return {
      isValid: false,
      isDemoMode: true,
      supabaseUrl: isPlaceholder ? '' : urlResult.url,
      supabaseAnonKey: '',
      maskedKey: maskKey(sanitizeEnvValue(rawKey)),
      host: isPlaceholder ? 'local-demo' : 'invalid-url',
      error: isPlaceholder ? undefined : urlResult.error,
      badVariable: isPlaceholder ? undefined : 'VITE_SUPABASE_URL',
    };
  }

  const keyResult = sanitizeSupabaseAnonKey(rawKey);
  if (keyResult.error) {
    const isPlaceholder = keyResult.error.includes('placeholder') || keyResult.error.includes('missing');
    return {
      isValid: false,
      isDemoMode: true,
      supabaseUrl: isPlaceholder ? '' : urlResult.url,
      supabaseAnonKey: '',
      maskedKey: maskKey(sanitizeEnvValue(rawKey)),
      host: isPlaceholder ? 'local-demo' : urlResult.url.replace('https://', ''),
      error: isPlaceholder ? undefined : keyResult.error,
      badVariable: isPlaceholder ? undefined : 'VITE_SUPABASE_ANON_KEY',
    };
  }

  return {
    isValid: true,
    isDemoMode: false,
    supabaseUrl: urlResult.url,
    supabaseAnonKey: keyResult.key,
    maskedKey: maskKey(keyResult.key),
    host: urlResult.url.replace('https://', ''),
  };
}
