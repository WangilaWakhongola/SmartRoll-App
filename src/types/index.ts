// ============================================================
// SmartRoll — Shared TypeScript Types
// Central type definitions used across the app. Import from
// here rather than re-declaring types in individual files.
// ============================================================

/** A user profile row from the `profiles` table */
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'lecturer';
  class_id?: string;
  student_id?: string;
  staff_id?: string;
  face_photo_url?: string;
  push_token?: string;
  created_at?: string;
}

/** A GPS coordinate pair using lat/lng naming (used in helpers.ts) */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** A row from the `classes` table */
export interface ClassInfo {
  id: string;
  name: string;
  /** Course code, e.g. "CS201" */
  class_id?: string;
  building?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  enrollment_open?: boolean;
  lecturer_id: string;
  instructor_id?: string;
  created_at?: string;
}

/** A row from the `sessions` table */
export interface Session {
  id: string;
  class_id: string;
  lecturer_id: string;
  instructor_id?: string;
  room_lat: number;
  room_lng: number;
  radius_metres: number;
  is_active: boolean;
  status: 'open' | 'closed';
  started_at: string;
  ended_at?: string;
}

/** A row from the `attendance` table */
export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  lat?: number;
  lng?: number;
  distance_metres?: number;
  face_match_score?: number;
  suspicious_flag?: boolean;
  signed_at: string;
  created_at?: string;
}

/** Possible values for an attendance record's status field */
export type AttendanceStatus = 'present' | 'absent' | 'late';

/** Possible geofence containment states */
export type GeofenceStatus = 'inside' | 'outside' | 'unknown';

/** Aggregated attendance report for a single student */
export interface StudentReport {
  student: Profile;
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}
