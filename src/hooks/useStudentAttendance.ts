// ============================================================
// SmartRoll — useStudentAttendance
// Fetches and submits attendance records for a student.
// Computes the student's overall attendance percentage and
// exposes an insertAttendance action for signing a session.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { round1dp } from '../utils/helpers';

/** Payload required to insert a new attendance record */
interface InsertPayload {
  session_id: string;
  lat: number;
  lng: number;
  distance_metres: number;
  status: AttendanceStatus;
}

/** State shape returned by useStudentAttendance */
interface StudentAttendanceState {
  records: AttendanceRecord[];
  /** Overall attendance percentage (0–100, 1 decimal place) */
  percentage: number;
  loading: boolean;
  error: string | null;
  inserting: boolean;
  /**
   * Inserts a new attendance record for the student.
   * student_id is set by RLS to auth.uid() — do not pass it explicitly.
   * @param payload - the attendance data to insert
   */
  insertAttendance(payload: InsertPayload): Promise<void>;
  /** Re-fetches attendance records from Supabase */
  refetch(): Promise<void>;
}

/**
 * useStudentAttendance
 * Fetches all attendance records for the given student ordered by sign-in
 * time descending. Computes the overall attendance percentage and provides
 * an insertAttendance action.
 *
 * @param studentId - the student's UUID, or null
 * @returns StudentAttendanceState
 */
export function useStudentAttendance(studentId: string | null): StudentAttendanceState {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);

  /**
   * Fetches all attendance records for this student from the attendance table.
   * Queries: attendance WHERE student_id = studentId ORDER BY signed_at DESC
   */
  const fetchRecords = useCallback(async () => {
    if (!studentId) { setRecords([]); setPercentage(0); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from('attendance').select('*').eq('student_id', studentId).order('signed_at', { ascending: false });
      if (err) throw err;
      const rows = (data ?? []) as AttendanceRecord[];
      setRecords(rows);
      // Compute overall attendance percentage
      const total   = rows.length;
      const present = rows.filter(r => r.status === 'present').length;
      setPercentage(total > 0 ? round1dp((present / total) * 100) : 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  // Watches: studentId (via fetchRecords)
  // Effect: loads attendance records when the student ID changes
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /**
   * Inserts a new attendance record into the attendance table.
   * student_id is intentionally omitted — it is set by the RLS policy
   * to auth.uid() to prevent spoofing.
   * @param payload - session, location, distance, and status data
   */
  async function insertAttendance(payload: InsertPayload) {
    setInserting(true); setError(null);
    try {
      const { error: err } = await supabase.from('attendance').insert({
        session_id:      payload.session_id,
        lat:             payload.lat,
        lng:             payload.lng,
        distance_metres: payload.distance_metres,
        status:          payload.status,
      });
      if (err) throw err;
      await fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign attendance');
    } finally {
      setInserting(false);
    }
  }

  return { records, percentage, loading, error, inserting, insertAttendance, refetch: fetchRecords };
}
