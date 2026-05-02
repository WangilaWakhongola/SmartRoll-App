// ============================================================
// SmartRoll — useLecturerAttendance
// Real-time attendance tracking for a live session.
// Fetches existing records on mount and subscribes to INSERT
// events so the instructor's view updates as students sign in.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { AttendanceRecord } from '../types';

type RealtimeStatus = 'connected' | 'reconnecting';

/** An attendance record enriched with the student's profile data */
interface AttendanceWithProfile extends AttendanceRecord {
  profile?: { id: string; full_name: string; student_id?: string };
}

/** State shape returned by useLecturerAttendance */
interface LecturerAttendanceState {
  records: AttendanceWithProfile[];
  presentCount: number;
  absentCount: number;
  totalEnrolled: number;
  attendanceRate: number;
  recentSignIns: AttendanceWithProfile[];
  realtimeStatus: RealtimeStatus;
  loading: boolean;
  error: string | null;
}

/**
 * useLecturerAttendance
 * Fetches all attendance records for the given session and subscribes to
 * real-time INSERT events so the list updates live as students sign in.
 *
 * @param activeSessionId - UUID of the currently active session, or null
 * @returns LecturerAttendanceState with records, counts, and connection status
 */
export function useLecturerAttendance(activeSessionId: string | null): LecturerAttendanceState {
  const [records, setRecords] = useState<AttendanceWithProfile[]>([]);
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all attendance records for the active session, joining profile data.
   * Queries: attendance JOIN profiles WHERE session_id = activeSessionId
   */
  const fetchRecords = useCallback(async () => {
    if (!activeSessionId) { setRecords([]); setTotalEnrolled(0); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from('attendance')
        .select('*, profile:profiles(id, full_name, student_id)')
        .eq('session_id', activeSessionId)
        .order('signed_at', { ascending: false });
      if (err) throw err;
      setRecords((data ?? []) as AttendanceWithProfile[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  /**
   * Fetches the total number of enrolled students for the session's class.
   * Queries: sessions WHERE id = activeSessionId → profiles WHERE class_id = classId
   */
  const fetchEnrolled = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      // Get the class_id for this session
      const { data: s } = await supabase.from('sessions').select('class_id').eq('id', activeSessionId).single();
      if (!s) return;
      // Count enrolled students in that class
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('class_id', s.class_id).eq('role', 'student');
      setTotalEnrolled(count ?? 0);
    } catch { /* non-fatal — enrollment count is informational */ }
  }, [activeSessionId]);

  // Watches: activeSessionId (via fetchRecords/fetchEnrolled)
  // Effect: loads records and enrollment count when the session changes
  useEffect(() => { fetchRecords(); fetchEnrolled(); }, [fetchRecords, fetchEnrolled]);

  // Watches: activeSessionId
  // Effect: subscribes to real-time INSERT events on the attendance table
  //         so new sign-ins appear instantly without polling
  useEffect(() => {
    if (!activeSessionId) return;
    const channel = supabase
      .channel(`lecturer-attendance-${activeSessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `session_id=eq.${activeSessionId}` },
        async (payload) => {
          // Fetch the full record with profile join for the newly inserted row
          const { data } = await supabase
            .from('attendance').select('*, profile:profiles(id, full_name, student_id)')
            .eq('id', (payload.new as AttendanceRecord).id).single();
          if (data) setRecords(prev => [data as AttendanceWithProfile, ...prev]);
        })
      .subscribe(status => {
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting');
      });
    return () => { supabase.removeChannel(channel); };
  }, [activeSessionId]);

  // Derived counts
  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount  = totalEnrolled - presentCount;
  const attendanceRate = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 1000) / 10 : 0;

  return { records, presentCount, absentCount, totalEnrolled, attendanceRate, recentSignIns: records.slice(0, 10), realtimeStatus, loading, error };
}
