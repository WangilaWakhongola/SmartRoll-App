// ============================================================
// SmartRoll — useStudentSession
// Watches for an active session in the student's enrolled class.
// Subscribes to real-time UPDATE events so the student's view
// reflects session open/close changes immediately.
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '../types';

/** State shape returned by useStudentSession */
interface StudentSessionState {
  activeSession: Session | null;
  loading: boolean;
  error: string | null;
}

/**
 * useStudentSession
 * Fetches the currently active session for the given class and subscribes
 * to real-time UPDATE events so the session state stays in sync with the
 * instructor's actions (opening/closing a session).
 *
 * @param classId - the student's enrolled class UUID, or null
 * @returns StudentSessionState
 */
export function useStudentSession(classId: string | null): StudentSessionState {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Watches: classId
  // Effect: fetches the active session and subscribes to real-time updates
  useEffect(() => {
    if (!classId) { setActiveSession(null); setLoading(false); return; }
    let mounted = true;

    /**
     * Fetches the active session for this class.
     * Queries: sessions WHERE class_id = classId AND is_active = true
     */
    async function fetchActiveSession() {
      setLoading(true); setError(null);
      try {
        const { data, error: err } = await supabase
          .from('sessions').select('*').eq('class_id', classId).eq('is_active', true).maybeSingle();
        if (err) throw err;
        if (mounted) setActiveSession(data as Session | null);
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchActiveSession();

    // Subscribe to session UPDATE events for this class so open/close
    // changes from the instructor are reflected immediately
    const channel = supabase
      .channel(`student-session-${classId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `class_id=eq.${classId}` },
        (payload) => {
          if (mounted) {
            const updated = payload.new as Session;
            // Clear active session when the instructor closes it
            setActiveSession(updated.is_active ? updated : null);
          }
        })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [classId]);

  return { activeSession, loading, error };
}
