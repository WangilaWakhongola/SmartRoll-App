// ============================================================
// SmartRoll — Anti-Proxy Detection Utility
// Feature: student-attendance-flow
// ============================================================

import {
  PROXY_GPS_ACCURACY_MIN_M,
  PROXY_GPS_ACCURACY_MAX_M,
  PROXY_MAX_SPEED_MPS,
  PROXY_SPEED_WINDOW_S,
  PROXY_COLLISION_RADIUS_M,
  FACE_MATCH_THRESHOLD,
} from '../constants/attendance';

/**
 * Parameters passed to the proxy-check function.
 */
export interface ProxyCheckParams {
  /** GPS accuracy in metres (null if unavailable). */
  accuracy: number | null;
  /** The student's current GPS coordinates. */
  currentCoords: { latitude: number; longitude: number };
  /**
   * The student's most recent prior attendance record (used for speed check).
   * null if no prior record exists.
   */
  lastAttendance: { lat: number; lng: number; signed_at: string } | null;
  /**
   * All other attendance records for the same session (used for collision check).
   * lat/lng may be null if the record was submitted without GPS.
   */
  sameSessionAttendance: Array<{ lat: number | null; lng: number | null }>;
  /** Cosine-similarity face-match score (0–1). */
  faceMatchScore: number;
}

/**
 * Result returned by computeProxyFlags.
 */
export interface ProxyCheckResult {
  /** True if any proxy rule fired. */
  suspicious_flag: boolean;
  /**
   * Human-readable reason for the first rule that fired.
   * Empty string when suspicious_flag is false.
   */
  proxy_reason: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Haversine distance between two GPS points.
 * Uses { latitude, longitude } coordinate shape (matching GeofenceService).
 * @returns distance in metres
 */
function haversineMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const val =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Evaluate all five anti-proxy rules in order and return the first match.
 *
 * Rules (in priority order):
 *  1. accuracy < 1 m  → mocked GPS
 *  2. accuracy > 500 m → GPS signal too weak
 *  3. speed > 30 m/s within 1-hour window → impossible movement
 *  4. same-session location collision within 2 m → possible proxy
 *  5. faceMatchScore < 0.72 → face mismatch (caller is responsible for blocking submission)
 *
 * Returns the first matching reason. suspicious_flag is true if any rule fires.
 * The face-mismatch rule sets the flag but does NOT block submission here —
 * the calling hook (useAttendanceFlow) is responsible for that.
 */
export function computeProxyFlags(params: ProxyCheckParams): ProxyCheckResult {
  const { accuracy, currentCoords, lastAttendance, sameSessionAttendance, faceMatchScore } = params;

  // ── Rule 1: Mocked GPS (accuracy suspiciously perfect) ──────────────────
  if (accuracy !== null && accuracy < PROXY_GPS_ACCURACY_MIN_M) {
    return {
      suspicious_flag: true,
      proxy_reason: 'Mocked GPS detected (accuracy too perfect)',
    };
  }

  // ── Rule 2: GPS signal too weak ──────────────────────────────────────────
  if (accuracy !== null && accuracy > PROXY_GPS_ACCURACY_MAX_M) {
    return {
      suspicious_flag: true,
      proxy_reason: 'Location accuracy too low — GPS signal required',
    };
  }

  // ── Rule 3: Impossible movement speed ────────────────────────────────────
  if (lastAttendance !== null) {
    const prevCoords = { latitude: lastAttendance.lat, longitude: lastAttendance.lng };
    const distMetres = haversineMetres(prevCoords, currentCoords);

    const prevTime = new Date(lastAttendance.signed_at).getTime();
    const nowTime = Date.now();
    const timeDiffSeconds = (nowTime - prevTime) / 1000;

    // Only apply the speed check within the configured time window
    if (timeDiffSeconds > 0 && timeDiffSeconds < PROXY_SPEED_WINDOW_S) {
      const speedMps = distMetres / timeDiffSeconds;
      if (speedMps > PROXY_MAX_SPEED_MPS) {
        const speedRounded = Math.round(speedMps * 10) / 10;
        return {
          suspicious_flag: true,
          proxy_reason: `Impossible movement detected — speed ${speedRounded} m/s exceeds ${PROXY_MAX_SPEED_MPS} m/s`,
        };
      }
    }
  }

  // ── Rule 4: Same-session location collision ───────────────────────────────
  for (const record of sameSessionAttendance) {
    if (record.lat === null || record.lng === null) continue;
    const otherCoords = { latitude: record.lat, longitude: record.lng };
    const dist = haversineMetres(currentCoords, otherCoords);
    if (dist < PROXY_COLLISION_RADIUS_M) {
      return {
        suspicious_flag: true,
        proxy_reason: 'Location matches another student exactly — possible proxy',
      };
    }
  }

  // ── Rule 5: Face mismatch ─────────────────────────────────────────────────
  if (faceMatchScore < FACE_MATCH_THRESHOLD) {
    return {
      suspicious_flag: true,
      proxy_reason: `Face match score too low (${Math.round(faceMatchScore * 100)}%) — possible impersonation`,
    };
  }

  // ── No rule fired ─────────────────────────────────────────────────────────
  return {
    suspicious_flag: false,
    proxy_reason: '',
  };
}
