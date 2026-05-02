// ============================================================
// SmartRoll — useLecturerSession
// Manages session lifecycle for an instructor: fetches existing
// sessions, exposes the currently active session, and provides
// startSession / endSession actions.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '../types';

/** State shape returned by useLecturerSession */
interface LecturerSessionState {
  sessions: Session[];
  activeSession: Session | null;
  loading: boolean;
  error: string | null;
  /**
   * Creates a new open session for the given class.
   * @param classId - UUID of the class
   * @param roomLat - classroom latitude
   * @param roomLng - classroom longitude
   * @param radiusMetres - geofence radius in metres
   */
  startSession(classId: string, roomLat: number, roomLng: number, radiusMetres: number): Promise<void>;
  /**
   * Closes an active session by setting is_active=false and status='closed'.
   * @param sessionId - UUID of the session to close
   */
  endSession(sessionId: string): Promise<void>;
}

/**
 * useLecturerSession
 * Fetches all sessions for the given lecturer and tracks the active one.
 * Provides startSession and endSession actions that update Supabase and
 * keep local state in sync.
 *
 * @param lecturerId - UUID of the authenticated lecturer, or null
 * @returns LecturerSessionState
 */
export function useLecturerSession(lecturerId: string | null): LecturerSessionState {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all sessions for this lecturer ordered by start time descending.
   * Queries: sessions WHERE lecturer_id = lecturerId
   */
  const fetchSessions = useCallback(async () => {
    if (!lecturerId) { setSessions([]); setActiveSession(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sessions').select('*').eq('lecturer_id', lecturerId).order('started_at', { ascending: false });
      if (err) throw err;
      const rows = (data ?? []) as Session[];
      setSessions(rows);
      setActiveSession(rows.find(s => s.is_active) ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [lecturerId]);

  // Watches: lecturerId (via fetchSessions)
  // Effect: loads sessions when the lecturer ID changes
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  /**
   * Inserts a new session row into the sessions table and updates local state.
   * Sets is_active=true and status='open'.
   */
  async function startSession(classId: string, roomLat: number, roomLng: number, radiusMetres: number) {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .insert({ class_id: classId, room_lat: roomLat, room_lng: roomLng, radius_metres: radiusMetres, is_active: true, status: 'open' })
        .select().single();
      if (err) throw err;
      const s = data as Session;
      setSessions(prev => [s, ...prev]);
      setActiveSession(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }

  /**
   * Updates the session row to is_active=false, status='closed', and sets ended_at.
   * Clears the activeSession from local state.
   */
  async function endSession(sessionId: string) {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .update({ is_active: false, status: 'closed', ended_at: new Date().toISOString() })
        .eq('id', sessionId).select().single();
      if (err) throw err;
      const updated = data as Session;
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
      setActiveSession(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
    }
  }

  return { sessions, activeSession, loading, error, startSession, endSession };
}
