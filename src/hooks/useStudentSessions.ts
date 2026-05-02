// ============================================================
// SmartRoll — useStudentSessions
// Fetches sessions for a student's enrolled class, derives a
// status for each (pending/signed/missed/upcoming), and
// subscribes to real-time updates on sessions and attendance.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { formatTime } from '../utils/helpers';
import { DEFAULT_GEOFENCE_RADIUS_M } from '../constants/attendance';
import { logger } from '../utils/logger';
import * as Location from 'expo-location';

// ── Types ─────────────────────────────────────────────────────

/** A session item as displayed on the student dashboard */
export interface SessionItem {
  id: string;
  sessionId: string;
  /** Derived from class name initials, e.g. "DSAA" */
  code: string;
  name: string;
  /** Formatted time range, e.g. "09:00 – 11:00" */
  time: string;
  /** Formatted lat/lng string used as room label */
  room: string;
  status: 'pending' | 'signed' | 'missed' | 'upcoming';
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/** Return type of useStudentSessions */
export interface UseStudentSessionsResult {
  sessions: SessionItem[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

/**
 * Reverse geocodes a lat/lng to a human-readable room label.
 * Falls back to formatted coordinates if geocoding fails or is unavailable.
 */
async function getRoomLabel(lat: number, lng: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results.length > 0) {
      const r = results[0];
      // Build a short label: "Block A, Nairobi" or "Room 101, Street Name"
      const parts = [r.name, r.street, r.district, r.city].filter(Boolean);
      if (parts.length > 0) return parts.slice(0, 2).join(', ');
    }
  } catch {
    // Geocoding failed — fall back to coordinates
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * useStudentSessions
 * Fetches today's (and active) sessions for the student's enrolled class.
 * Derives a status for each session based on is_active and whether the
 * student has a matching attendance record.
 *
 * Subscribes to real-time changes on both the sessions and attendance tables
 * so the list updates automatically when a session opens or the student signs.
 *
 * @param userId - the authenticated student's UUID, or null
 * @param classId - the student's enrolled class UUID, or null
 * @returns UseStudentSessionsResult
 */
export function useStudentSessions(
  userId: string | null,
  classId: string | null,
): UseStudentSessionsResult {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetches sessions and derives their status for the current student.
   * @param isRefresh - if true, sets refreshing state instead of loading
   */
  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (!userId || !classId) {
      setSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch the student's profile to get class info for code derivation
      const { data: profile } = await supabase
        .from('profiles')
        .select('class_id, classes(id, name)')
        .eq('id', userId)
        .single();

      const classInfo = (profile as any)?.classes ?? null;

      // Fetch active sessions and today's sessions for this class
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: rawSessions } = await supabase
        .from('sessions')
        .select('id, class_id, room_lat, room_lng, radius_metres, is_active, started_at, ended_at')
        .eq('class_id', classId)
        .or(`is_active.eq.true,started_at.gte.${todayStart.toISOString()}`)
        .order('started_at', { ascending: false });

      const sessionList = rawSessions ?? [];
      const sessionIds = sessionList.map((s: any) => s.id);

      // Fetch the student's signed session IDs for duplicate detection
      let signedIds: string[] = [];
      if (sessionIds.length > 0) {
        const { data: logs } = await supabase
          .from('attendance')
          .select('session_id')
          .eq('student_id', userId)
          .in('session_id', sessionIds);
        signedIds = (logs ?? []).map((l: any) => l.session_id);
      }

      // Derive a short code from the class name initials (up to 6 chars)
      const code: string =
        classInfo?.name
          ?.split(' ')
          .map((w: string) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 6) ?? 'CLASS';

      const className: string = classInfo?.name ?? 'My Class';

      // Map raw session rows to SessionItem with derived status
      // Reverse geocode room coordinates in parallel for all sessions
      const roomLabels = await Promise.all(
        sessionList.map((session: any) =>
          getRoomLabel(session.room_lat ?? 0, session.room_lng ?? 0)
        )
      );

      const mapped: SessionItem[] = sessionList.map((session: any, idx: number) => {
        let status: SessionItem['status'] = 'upcoming';
        if (signedIds.includes(session.id)) {
          status = 'signed';
        } else if (session.is_active) {
          status = 'pending';
        } else if (!session.is_active && session.ended_at) {
          status = 'missed';
        }

        return {
          id: session.id,
          sessionId: session.id,
          code,
          name: className,
          time: `${formatTime(session.started_at)} – ${session.ended_at ? formatTime(session.ended_at) : 'Ongoing'}`,
          room: roomLabels[idx],
          status,
          latitude: session.room_lat ?? 0,
          longitude: session.room_lng ?? 0,
          radiusMeters: session.radius_metres ?? DEFAULT_GEOFENCE_RADIUS_M,
        };
      });

      setSessions(mapped);
    } catch (err) {
      logger.error('useStudentSessions', 'fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, classId]);

  // Watches: fetchSessions (depends on userId, classId)
  // Effect: initial data load
  useEffect(() => {
    fetchSessions(false);
  }, [fetchSessions]);

  // Watches: userId, classId
  // Effect: subscribes to real-time session and attendance changes so the
  //         list updates automatically without manual refresh
  useEffect(() => {
    if (!userId || !classId) return;

    // Channel 1: session changes for this class (open/close events)
    const sessionsChannel = supabase
      .channel(`student-sessions-${classId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `class_id=eq.${classId}` },
        () => { fetchSessions(false); },
      )
      .subscribe();

    // Channel 2: new attendance records for this student (sign-in events)
    const attendanceChannel = supabase
      .channel(`student-attendance-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance', filter: `student_id=eq.${userId}` },
        () => { fetchSessions(false); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(attendanceChannel);
    };
  }, [userId, classId, fetchSessions]);

  const refresh = useCallback(() => {
    fetchSessions(true);
  }, [fetchSessions]);

  return { sessions, loading, refreshing, refresh };
}
