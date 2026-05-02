// Feature: student-attendance-flow, Property 1: geofence classification

import * as fc from 'fast-check';
import { GeofenceService } from '../geofence.service';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Valid latitude in [-90, 90] */
const latArb = fc.double({ min: -90, max: 90, noNaN: true });

/** Valid longitude in [-180, 180] */
const lngArb = fc.double({ min: -180, max: 180, noNaN: true });

/** Positive radius in metres (1 m – 10 km) */
const radiusArb = fc.double({ min: 1, max: 10_000, noNaN: true });

/** User coordinates record */
const userCoordsArb = fc.record({ latitude: latArb, longitude: lngArb });

/** Fence config record */
const fenceArb = fc.record({
  latitude: latArb,
  longitude: lngArb,
  radiusMeters: radiusArb,
});

// ---------------------------------------------------------------------------
// Property 1: Geofence classification is consistent with distance
// Validates: Requirements 1.4, 1.5, 1.6
// ---------------------------------------------------------------------------
describe('GeofenceService — P1: geofence classification consistent with distance', () => {
  /**
   * P1a: isInsideGeofence returns true iff haversineMetres <= radiusMeters
   *
   * For any user coordinates and any fence configuration, the boolean result
   * of isInsideGeofence must agree exactly with the comparison
   * haversineMetres(userCoords, fenceCenter) <= fence.radiusMeters.
   *
   * Validates: Requirements 1.4, 1.5, 1.6
   */
  it('P1a: isInsideGeofence returns true iff haversineMetres <= radiusMeters', () => {
    fc.assert(
      fc.property(userCoordsArb, fenceArb, (userCoords, fence) => {
        const dist = GeofenceService.haversineMetres(userCoords, {
          latitude: fence.latitude,
          longitude: fence.longitude,
        });
        const expected = dist <= fence.radiusMeters;
        const actual = GeofenceService.isInsideGeofence(userCoords, fence);
        return actual === expected;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * P1b: isInsideGeofence is consistent with haversineMetres — they agree on
   * inside/outside for any inputs.
   *
   * This is a restatement of P1a from the perspective of the two functions
   * being consistent with each other: if haversineMetres says the distance is
   * within the radius, isInsideGeofence must say true, and vice versa.
   *
   * Validates: Requirements 1.4, 1.5, 1.6
   */
  it('P1b: isInsideGeofence is consistent with haversineMetres — they agree on inside/outside', () => {
    fc.assert(
      fc.property(userCoordsArb, fenceArb, (userCoords, fence) => {
        const fenceCenter = { latitude: fence.latitude, longitude: fence.longitude };
        const dist = GeofenceService.haversineMetres(userCoords, fenceCenter);
        const inside = GeofenceService.isInsideGeofence(userCoords, fence);

        if (dist <= fence.radiusMeters) {
          return inside === true;
        } else {
          return inside === false;
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * P1c: Boundary — when distance exactly equals radius, should be inside (≤ not <)
   *
   * The spec uses ≤ (less-than-or-equal), so a student standing exactly on the
   * geofence boundary must be classified as inside.
   *
   * Strategy: place the user at a known offset from the fence center, compute
   * the exact haversine distance, then set radiusMeters to that exact distance.
   * isInsideGeofence must return true.
   *
   * Validates: Requirements 1.5 (≤ boundary)
   */
  it('P1c: boundary — when distance exactly equals radius, student is inside (≤ not <)', () => {
    fc.assert(
      fc.property(
        // Fence center
        fc.double({ min: -80, max: 80, noNaN: true }),   // fenceLat
        fc.double({ min: -170, max: 170, noNaN: true }), // fenceLng
        // Small offset to create a non-zero distance
        fc.double({ min: 0.0001, max: 0.5, noNaN: true }), // latOffset
        (fenceLat, fenceLng, latOffset) => {
          const userCoords = { latitude: fenceLat + latOffset, longitude: fenceLng };
          const fenceCenter = { latitude: fenceLat, longitude: fenceLng };

          // Compute the exact haversine distance
          const exactDist = GeofenceService.haversineMetres(userCoords, fenceCenter);

          // Set radius to exactly that distance — boundary case
          const fence = { latitude: fenceLat, longitude: fenceLng, radiusMeters: exactDist };

          return GeofenceService.isInsideGeofence(userCoords, fence) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P1d: When user is at the exact fence center (distance = 0), always inside.
   *
   * A student standing at the exact GPS coordinates of the classroom must
   * always be classified as inside, regardless of the radius value.
   *
   * Validates: Requirements 1.5 (distance 0 is always ≤ any positive radius)
   */
  it('P1d: when user is at the exact fence center (distance = 0), always inside', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),   // lat
        fc.double({ min: -170, max: 170, noNaN: true }), // lng
        radiusArb,
        (lat, lng, radiusMeters) => {
          // User is at the exact fence center
          const userCoords = { latitude: lat, longitude: lng };
          const fence = { latitude: lat, longitude: lng, radiusMeters };

          const dist = GeofenceService.haversineMetres(userCoords, {
            latitude: fence.latitude,
            longitude: fence.longitude,
          });

          // Distance should be 0 (or extremely close due to floating-point)
          const distIsZero = dist < 1e-6;
          const inside = GeofenceService.isInsideGeofence(userCoords, fence);

          return distIsZero && inside === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
