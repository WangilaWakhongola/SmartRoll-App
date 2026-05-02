// ============================================================
// SmartRoll — Attendance Context
// Provides the currently active session for the student's
// enrolled class. Subscribes to real-time session changes so
// the context updates automatically when a session opens or closes.
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

/** The active session shape exposed by AttendanceContext */
interface ActiveSession {
  id: string;
  classId: string;
  lecturerId: string;
  roomLat: number;
  roomLng: number;
  radiusMetres: number;
  isActive: boolean;
  startedAt: string;
}

/** Value shape exposed by AttendanceContext */
interface AttendanceContextValue {
  activeSession: ActiveSession | null;
  loading: boolean;
  /** Triggers a manual re-fetch of the active session */
  refetch: () => void;
}

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

/**
 * AttendanceProvider
 * Fetches the active session for the student's enrolled class on mount
 * and whenever the class ID or tick counter changes. Subscribes to
 * real-time session changes so the context stays in sync with the
 * instructor's actions.
 */
export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  // Incrementing tick triggers a manual re-fetch via refetch()
  const [tick, setTick] = useState(0);

  // Watches: user?.classId, tick
  // Effect: fetches the active session and subscribes to real-time updates
  useEffect(() => {
    if (!user?.classId) {
      setActiveSession(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    /**
     * Fetches the active session for the student's class.
     * Queries: sessions WHERE class_id = user.classId AND is_active = true
     */
    const fetchSession = async () => {
      try {
        const { data } = await supabase
          .from('sessions')
          .select('*')
          .eq('class_id', user.classId)
          .eq('is_active', true)
          .maybeSingle();

        if (mounted && data) {
          setActiveSession({
            id:            data.id,
            classId:       data.class_id,
            lecturerId:    data.lecturer_id,
            roomLat:       data.room_lat,
            roomLng:       data.room_lng,
            radiusMetres:  data.radius_metres,
            isActive:      data.is_active,
            startedAt:     data.started_at,
          });
        } else if (mounted) {
          setActiveSession(null);
        }
      } catch {
        if (mounted) setActiveSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSession();

    // Subscribe to session changes for this class so open/close events
    // from the instructor are reflected immediately in the context
    const channel = supabase
      .channel(`attendance-ctx-${user.classId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `class_id=eq.${user.classId}` },
        (payload) => {
          if (!mounted) return;
          const s = payload.new as any;
          if (s?.is_active) {
            setActiveSession({
              id:           s.id,
              classId:      s.class_id,
              lecturerId:   s.lecturer_id,
              roomLat:      s.room_lat,
              roomLng:      s.room_lng,
              radiusMetres: s.radius_metres,
              isActive:     s.is_active,
              startedAt:    s.started_at,
            });
          } else {
            setActiveSession(null);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.classId, tick]);

  return (
    <AttendanceContext.Provider
      value={{ activeSession, loading, refetch: () => setTick((t) => t + 1) }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

/**
 * useAttendance
 * Returns the AttendanceContext value. Must be called inside AttendanceProvider.
 * @throws Error if called outside of AttendanceProvider
 */
export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be inside AttendanceProvider');
  return ctx;
}
