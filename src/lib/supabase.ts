import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    supabaseUrl.startsWith('https://') &&
    !supabasePublishableKey.includes('YOUR_')
);

const REMEMBER_ME_KEY = 'triplegder_remember_me';
const REMEMBERED_EMAIL_KEY = 'triplegder_remembered_email';

export function getRememberMePreference(): boolean {
  try {
    const val = window.localStorage.getItem(REMEMBER_ME_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setRememberMePreference(remember: boolean, email?: string): void {
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, String(remember));
    if (remember && email) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else if (!remember) {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch {
    // Storage access unavailable
  }
}

export function getRememberedEmail(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

// Custom auth storage adapter respecting "Remember me" choice
const adaptiveStorage = {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (getRememberMePreference()) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage unavailable
    }
  },
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: adaptiveStorage,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export const RECEIPT_BUCKET = 'trip-receipts';
