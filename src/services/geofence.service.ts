// ============================================================
// SmartRoll — Geofence Service
// Provides GPS-based geofence checks using the Haversine formula.
// Used by useAttendanceFlow to determine whether a student is
// physically inside the classroom boundary before signing.
// ============================================================

/** GPS coordinate pair */
interface Coords {
  latitude: number;
  longitude: number;
}

/** Configuration for a circular geofence */
interface GeofenceConfig {
  latitude: number;
  longitude: number;
  /** Radius of the geofence in metres */
  radiusMeters: number;
}

/**
 * GeofenceService
 * Static utility class for geofence distance and containment checks.
 */
export class GeofenceService {
  /**
   * Computes the Haversine distance between two GPS coordinates.
   * @param a - first coordinate
   * @param b - second coordinate
   * @returns distance in metres
   */
  static haversineMetres(a: Coords, b: Coords): number {
    const R = 6371000; // Earth radius in metres
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

  /**
   * Returns true if the user's coordinates are within the geofence radius.
   * @param userCoords - the student's current GPS position
   * @param fence - the classroom geofence configuration
   * @returns true if inside the geofence
   */
  static isInsideGeofence(userCoords: Coords, fence: GeofenceConfig): boolean {
    const dist = GeofenceService.haversineMetres(userCoords, {
      latitude: fence.latitude,
      longitude: fence.longitude,
    });
    return dist <= fence.radiusMeters;
  }

  /**
   * Returns the rounded distance in metres from the user to the geofence centre.
   * @param userCoords - the student's current GPS position
   * @param fence - the classroom geofence configuration
   * @returns distance in metres (rounded to nearest integer)
   */
  static distanceToFence(userCoords: Coords, fence: GeofenceConfig): number {
    return Math.round(
      GeofenceService.haversineMetres(userCoords, {
        latitude: fence.latitude,
        longitude: fence.longitude,
      })
    );
  }
}
