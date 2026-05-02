// ============================================================
// SmartRoll — useLecturerReports
// Builds per-student attendance reports for a given class.
// Fetches all students, sessions, and attendance records, then
// computes present/absent/late counts and a percentage for each.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile, AttendanceRecord, StudentReport } from '../types';
import { round1dp } from '../utils/helpers';

/** State shape returned by useLecturerReports */
interface LecturerReportsState {
  reports: StudentReport[];
  loading: boolean;
  error: string | null;
  refetch(): Promise<void>;
}

/**
 * useLecturerReports
 * Fetches all students enrolled in the given class, all sessions for that
 * class, and all attendance records. Derives a StudentReport for each student
 * sorted by attendance percentage descending.
 *
 * @param classId - UUID of the class to report on, or null
 * @returns LecturerReportsState with sorted reports array and refetch function
 */
export function useLecturerReports(classId: string | null): LecturerReportsState {
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches and computes attendance reports for all students in the class.
   * Queries: profiles (students), sessions, and attendance tables.
   */
  const fetchReports = useCallback(async () => {
    if (!classId) { setReports([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // Fetch all students enrolled in this class
      const { data: profilesData, error: pErr } = await supabase
        .from('profiles').select('*').eq('class_id', classId).eq('role', 'student');
      if (pErr) throw pErr;
      const students = (profilesData ?? []) as Profile[];
      if (students.length === 0) { setReports([]); return; }

      // Fetch all session IDs for this class
      const { data: sessionsData, error: sErr } = await supabase
        .from('sessions').select('id').eq('class_id', classId);
      if (sErr) throw sErr;
      const sessionIds = (sessionsData ?? []).map((s: { id: string }) => s.id);

      // Fetch all attendance records for those sessions
      let allAttendance: AttendanceRecord[] = [];
      if (sessionIds.length > 0) {
        const { data: attData, error: aErr } = await supabase
          .from('attendance').select('*').in('session_id', sessionIds);
        if (aErr) throw aErr;
        allAttendance = (attData ?? []) as AttendanceRecord[];
      }

      // Build a StudentReport for each enrolled student
      const built: StudentReport[] = students.map(student => {
        const recs = allAttendance.filter(r => r.student_id === student.id);
        const total   = recs.length;
        const present = recs.filter(r => r.status === 'present').length;
        const absent  = recs.filter(r => r.status === 'absent').length;
        const late    = recs.filter(r => r.status === 'late').length;
        return { student, total, present, absent, late, percentage: total > 0 ? round1dp((present / total) * 100) : 0 };
      });

      // Sort by attendance percentage descending
      built.sort((a, b) => b.percentage - a.percentage);
      setReports(built);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  // Watches: classId (via fetchReports)
  // Effect: fetches reports when the class changes
  useEffect(() => { fetchReports(); }, [fetchReports]);

  return { reports, loading, error, refetch: fetchReports };
}
