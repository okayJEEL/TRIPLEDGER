import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  setRememberMePreference,
  supabase,
} from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isRecoveryMode: boolean;
  schemaMissing: boolean;
  authError: string | null;
  isAdmin: boolean;
  isFaculty: boolean;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateProfileName: (fullName: string) => Promise<{ error: string | null }>;
  clearRecoveryMode: () => void;
  recheckSchema: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [schemaMissing, setSchemaMissing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkSchemaExists = useCallback(async (): Promise<boolean> => {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if (error && (error.code === 'PGRST205' || error.message.includes('schema cache'))) {
        setSchemaMissing(true);
        return false;
      }
      setSchemaMissing(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchUserProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        setSchemaMissing(true);
        setAuthError(
          'TripLedger database tables are not created in Supabase yet. Run the SQL migrations in supabase/migrations/ to continue.'
        );
        return null;
      }
      setAuthError(`Unable to verify user role: ${error.message}`);
      return null;
    }

    if (!data) {
      setAuthError(
        `Authenticated as ${authUser.email}, but no TripLedger role profile was found in public.profiles. Link this user as admin or faculty_viewer in Supabase SQL Editor.`
      );
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      return null;
    }

    setSchemaMissing(false);
    setAuthError(null);
    return data as Profile;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let mounted = true;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hashParams.get('type') === 'recovery' || window.location.pathname === '/reset-password') {
      setIsRecoveryMode(true);
    }

    const initialize = async () => {
      try {
        await checkSchemaExists();
        const {
          data: { session: currentSession },
        } = await client.auth.getSession();

        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const loadedProfile = await fetchUserProfile(currentSession.user);
          if (mounted) setProfile(loadedProfile);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const loadedProfile = await fetchUserProfile(nextSession.user);
        if (mounted) setProfile(loadedProfile);
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkSchemaExists, fetchUserProfile]);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean): Promise<{ error: string | null }> => {
      if (!supabase) {
        return { error: 'Supabase client is not configured. Check your environment variables.' };
      }

      setAuthError(null);
      setRememberMePreference(rememberMe, email.trim());

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { error: 'Invalid login ID or password. Please verify your credentials and try again.' };
        }
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return { error: 'This account email has not been confirmed in Supabase Authentication yet.' };
        }
        return { error: error.message };
      }

      if (data.user) {
        const loadedProfile = await fetchUserProfile(data.user);
        if (!loadedProfile) {
          return {
            error:
              'Account signed in, but your TripLedger role profile is missing or database migrations have not been run yet.',
          };
        }
        setProfile(loadedProfile);
      }

      return { error: null };
    },
    [fetchUserProfile]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsRecoveryMode(false);
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<{ error: string | null }> => {
    if (!supabase) {
      return { error: 'Supabase client is not configured.' };
    }
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: string | null }> => {
    if (!supabase) {
      return { error: 'Supabase client is not configured.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: error.message };
    }
    setIsRecoveryMode(false);
    if (window.location.pathname === '/reset-password') {
      window.history.replaceState({}, '', '/');
    }
    return { error: null };
  }, []);

  const updateProfileName = useCallback(
    async (fullName: string): Promise<{ error: string | null }> => {
      if (!supabase || !user) return { error: 'Not authenticated.' };
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id)
        .select('*')
        .single();
      if (error) return { error: error.message };
      setProfile(data as Profile);
      return { error: null };
    },
    [user]
  );

  const clearRecoveryMode = useCallback(() => {
    setIsRecoveryMode(false);
    if (window.location.pathname === '/reset-password') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    isRecoveryMode,
    schemaMissing,
    authError,
    isAdmin: profile?.role === 'admin',
    isFaculty: profile?.role === 'faculty_viewer',
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    updateProfileName,
    clearRecoveryMode,
    recheckSchema: checkSchemaExists,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
