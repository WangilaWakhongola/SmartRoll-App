// ============================================================
// SmartRoll — useAttendance (Legacy Hook)
// Simple attendance submission hook that handles GPS location
// capture and distance calculation before inserting a record.
//
// NOTE: This is a legacy hook kept for backward compatibility.
// New code should use useAttendanceFlow (src/hooks/useAttendanceFlow.ts)
// which implements the full 3-step GPS → Selfie → Biometric flow.
// ============================================================

import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GeofenceService } from '../services/geofence.service';
import * as Location from 'expo-location';

/**
 * useAttendance (legacy)
 * Provides a single `submit` function that:
 *  1. Checks for an existing attendance record (duplicate guard).
 *  2. Requests the device's current GPS position.
 *  3. Computes the Haversine distance to the session room.
 *  4. Inserts an attendance record into the `attendance` table.
 *
 * @returns {{ submit: (sessionId: string, selfieBase64?: string) => Promise<void> }}
 */
export function useAttendance() {
  const { user } = useAuth();

  /**
   * Submits attendance for the given session.
   * @param sessionId - the UUID of the active session
   * @param selfieBase64 - optional base64-encoded selfie image (unused in legacy flow)
   * @throws Error if not authenticated, already signed, or insert fails
   */
  const submit = async (sessionId: string, selfieBase64?: string) => {
    if (!user) throw new Error('Not authenticated');

    // Check if the student has already signed for this session
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', user.id)
      .maybeSingle();

    if (existing) throw new Error('You have already signed attendance for this session');

    // Attempt to get the current GPS position
    let lat: number | null = null;
    let lng: number | null = null;
    let distanceMetres: number | null = null;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      lat = location.coords.latitude;
      lng = location.coords.longitude;

      // Fetch session room coordinates to compute distance
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('room_lat, room_lng, radius_metres')
        .eq('id', sessionId)
        .single();

      if (sessionData && lat && lng) {
        distanceMetres = GeofenceService.distanceToFence(
          { latitude: lat, longitude: lng },
          {
            latitude: sessionData.room_lat,
            longitude: sessionData.room_lng,
            radiusMeters: sessionData.radius_metres,
          },
        );
      }
    } catch {
      // Location is optional — the insert will still succeed without it
    }

    // Insert attendance record into the attendance table
    const { error } = await supabase.from('attendance').insert({
      session_id: sessionId,
      student_id: user.id,
      status: 'present',
      lat,
      lng,
      distance_metres: distanceMetres,
      signed_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
  };

  return { submit };
}
