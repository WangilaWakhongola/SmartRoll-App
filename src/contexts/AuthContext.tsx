// ============================================================
// SmartRoll — Auth Context
// Provides authentication state (session, user, loading) and
// actions (signIn, signUp, signOut, refreshUser) to the entire
// app via React context. Wraps Supabase Auth and maps profile
// rows to the AppUser shape.
// ============================================================

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { NotificationService } from '../services/notification.service';
import { PROFILE_FETCH_MAX_RETRIES, PROFILE_FETCH_RETRY_DELAY_MS } from '../constants/attendance';
import { logger } from '../utils/logger';

/** The authenticated user shape used throughout the app */
export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'lecturer' | 'instructor';
  studentId?: string;
  staffId?: string;
  classId?: string;
  facePhotoUrl?: string;
}

/** Value shape exposed by AuthContext */
interface AuthContextValue {
  session: any | null;
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    idValue: string,
    roleValue: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Maps a raw Supabase profile row to the AppUser shape.
 * @param data - raw profile row from the profiles table
 * @returns AppUser object
 */
function mapProfile(data: any): AppUser {
  return {
    id:           data.id,
    email:        data.email,
    fullName:     data.full_name,
    role:         data.role,
    studentId:    data.student_id  ?? undefined,
    staffId:      data.staff_id    ?? undefined,
    classId:      data.class_id    ?? undefined,
    facePhotoUrl: data.face_photo_url ?? undefined,
  };
}

/**
 * Fetches a user's profile from the profiles table with retry logic.
 * Retries up to PROFILE_FETCH_MAX_RETRIES times with a PROFILE_FETCH_RETRY_DELAY_MS
 * delay to handle the brief window after sign-up before the DB trigger creates the profile row.
 *
 * @param userId - the Supabase Auth user UUID
 * @param retries - maximum number of attempts (default PROFILE_FETCH_MAX_RETRIES)
 * @returns AppUser if found, null otherwise
 */
async function fetchProfile(userId: string, retries = PROFILE_FETCH_MAX_RETRIES): Promise<AppUser | null> {
  for (let i = 0; i < retries; i++) {
    try {
      // Fetch profile row from the profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, student_id, staff_id, class_id, face_photo_url')
        .eq('id', userId)
        .maybeSingle();

      if (error) logger.warn('AuthContext', `fetchProfile attempt ${i + 1} error`, error.message);
      if (data)  return mapProfile(data);
    } catch (e: any) {
      logger.warn('AuthContext', `fetchProfile attempt ${i + 1} exception`, e.message);
    }
    if (i < retries - 1) {
      logger.debug('AuthContext', `Retrying profile fetch in ${PROFILE_FETCH_RETRY_DELAY_MS}ms`, { attempt: i + 1 });
      await new Promise(r => setTimeout(r, PROFILE_FETCH_RETRY_DELAY_MS));
    }
  }
  logger.error('AuthContext', 'fetchProfile exhausted all retries', { userId });
  return null;
}

/**
 * AuthProvider
 * Wraps the app and provides auth state via AuthContext.
 * Initialises by restoring the existing session, then listens for
 * auth state changes (sign-in, sign-out, token refresh, user update).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user,    setUser]    = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevents double-loading when both init() and onAuthStateChange fire
  const initialised = useRef(false);

  // Watches: [] (runs once on mount)
  // Effect: restores the existing session and subscribes to auth state changes
  useEffect(() => {
    // Step 1: restore existing session synchronously from SecureStore
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        const profile = await fetchProfile(data.session.user.id);
        setUser(profile);
      }
      setLoading(false);
      initialised.current = true;
    }).catch(() => {
      setLoading(false);
      initialised.current = true;
    });

    // Step 2: listen for subsequent auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, sess) => {
      // Skip INITIAL_SESSION — already handled by getSession() above
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_IN' && sess) {
        setSession(sess);
        setLoading(true);
        const profile = await fetchProfile(sess.user.id);
        setUser(profile);
        setLoading(false);

        // Register for push notifications after sign-in
        NotificationService.registerForPushNotifications()
          .then(token => token && NotificationService.savePushToken(sess.user.id, token))
          .catch(() => {});

      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setLoading(false);

      } else if (event === 'TOKEN_REFRESHED' && sess) {
        setSession(sess);

      } else if (event === 'USER_UPDATED' && sess) {
        setSession(sess);
        const profile = await fetchProfile(sess.user.id);
        if (profile) setUser(profile);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  /**
   * Signs in with email and password via Supabase Auth.
   * @param email - the user's email address
   * @param password - the user's password
   * @returns `{ error: string | null }` — null on success
   */
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.user && !data.session) {
        return { error: 'Please confirm your email before logging in.' };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message ?? 'Sign in failed. Please try again.' };
    }
  };

  /**
   * Creates a new Supabase Auth user and upserts a profile row.
   * Normalises the role to 'student' or 'lecturer'.
   * @param email - the new user's email
   * @param password - the new user's password
   * @param fullName - the user's full name
   * @param idValue - student ID or staff ID depending on role
   * @param roleValue - 'student', 'lecturer', or 'instructor'
   * @returns `{ error: string | null }` — null on success
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    idValue: string,
    roleValue: string,
  ) => {
    const resolvedRole: 'student' | 'lecturer' =
      (roleValue === 'instructor' || roleValue === 'lecturer') ? 'lecturer' : 'student';
    const isLecturer = resolvedRole === 'lecturer';

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name:  fullName,
            role:       resolvedRole,
            student_id: isLecturer ? null : (idValue || null),
            staff_id:   isLecturer ? (idValue || null) : null,
          },
        },
      });

      if (error) return { error: error.message };

      // Email confirmation OFF → session available immediately → upsert profile
      if (data.session && data.user) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id:         data.user.id,
          email,
          full_name:  fullName,
          role:       resolvedRole,
          student_id: isLecturer ? null : (idValue || null),
          staff_id:   isLecturer ? (idValue || null) : null,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (upsertErr) logger.warn('AuthContext', 'signUp profile upsert failed', upsertErr.message);
      }
      // Email confirmation ON → DB trigger (handle_new_user) creates the profile

      return { error: null };
    } catch (err: any) {
      return { error: err.message ?? 'Sign up failed. Please try again.' };
    }
  };

  /**
   * Signs the current user out and clears local auth state.
   */
  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  /**
   * Re-fetches the current user's profile from Supabase and updates state.
   * Useful after profile edits (e.g. face photo upload).
   */
  const refreshUser = async () => {
    if (!session?.user?.id) return;
    const profile = await fetchProfile(session.user.id);
    if (profile) setUser(profile);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth
 * Returns the AuthContext value. Must be called inside an AuthProvider.
 * @throws Error if called outside of AuthProvider
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
