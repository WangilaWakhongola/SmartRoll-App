// Feature: student-attendance-flow, Property 6: GPS accuracy bounds
// Feature: student-attendance-flow, Property 7: impossible movement speed
// Feature: student-attendance-flow, Property 8: location collision

import * as fc from 'fast-check';
import { computeProxyFlags, ProxyCheckParams } from '../proxyDetection';

// ---------------------------------------------------------------------------
// Shared baseline params — all "safe" values so that only the accuracy rule
// can fire when we vary the accuracy field.
// ---------------------------------------------------------------------------
const safeBaseParams: Omit<ProxyCheckParams, 'accuracy'> = {
  currentCoords: { latitude: 1.3521, longitude: 103.8198 },
  lastAttendance: null,          // no prior record → speed rule cannot fire
  sameSessionAttendance: [],     // no other records → collision rule cannot fire
  faceMatchScore: 1.0,           // perfect match → face rule cannot fire
};

function makeParams(accuracy: number | null): ProxyCheckParams {
  return { ...safeBaseParams, accuracy };
}

// ---------------------------------------------------------------------------
// Property 6: GPS accuracy bounds
// Validates: Requirements 9.1, 9.2
// ---------------------------------------------------------------------------
describe('computeProxyFlags — P6: GPS accuracy bounds', () => {
  /**
   * P6a: Any accuracy value strictly less than 1 m must set suspicious_flag = true
   * and return the "Mocked GPS" reason.
   * Validates: Requirement 9.1
   */
  it('P6a: flags suspicious when accuracy < 1 m (mocked GPS)', () => {
    fc.assert(
      fc.property(
        // Generate doubles in [0, 1) — all values strictly less than 1
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (accuracy) => {
          const result = computeProxyFlags(makeParams(accuracy));
          return (
            result.suspicious_flag === true &&
            result.proxy_reason === 'Mocked GPS detected (accuracy too perfect)'
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P6b: Any accuracy value strictly greater than 500 m must set suspicious_flag = true
   * and return the "accuracy too low" reason.
   * Validates: Requirement 9.2
   */
  it('P6b: flags suspicious when accuracy > 500 m (weak GPS signal)', () => {
    fc.assert(
      fc.property(
        // Generate doubles in (500, 1_000_000] — all values strictly greater than 500
        fc.double({ min: 500, minExcluded: true, max: 1_000_000, noNaN: true }),
        (accuracy) => {
          const result = computeProxyFlags(makeParams(accuracy));
          return (
            result.suspicious_flag === true &&
            result.proxy_reason === 'Location accuracy too low — GPS signal required'
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P6c: Any accuracy value in the closed range [1, 500] must NOT set
   * suspicious_flag = true due to the accuracy check alone.
   * (All other proxy rules are neutralised by the safe base params.)
   * Validates: Requirements 9.1, 9.2 (negative case)
   */
  it('P6c: does NOT flag suspicious when accuracy is in [1, 500]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true }),
        (accuracy) => {
          const result = computeProxyFlags(makeParams(accuracy));
          return result.suspicious_flag === false && result.proxy_reason === '';
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P6d: null accuracy must not trigger either accuracy rule.
   * Validates: defensive behaviour when GPS accuracy is unavailable.
   */
  it('P6d: does NOT flag suspicious when accuracy is null', () => {
    const result = computeProxyFlags(makeParams(null));
    expect(result.suspicious_flag).toBe(false);
    expect(result.proxy_reason).toBe('');
  });

  /**
   * P6e: Boundary value — accuracy exactly 1 m must NOT be flagged.
   */
  it('P6e: boundary — accuracy exactly 1 m is not flagged', () => {
    const result = computeProxyFlags(makeParams(1));
    expect(result.suspicious_flag).toBe(false);
  });

  /**
   * P6f: Boundary value — accuracy exactly 500 m must NOT be flagged.
   */
  it('P6f: boundary — accuracy exactly 500 m is not flagged', () => {
    const result = computeProxyFlags(makeParams(500));
    expect(result.suspicious_flag).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Haversine helper (mirrors the internal implementation) — used to compute
// expected distances in P7 tests without importing the private function.
// ---------------------------------------------------------------------------
function haversineMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
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
// Property 7: Proxy flag — impossible movement speed
// Validates: Requirements 9.3
// ---------------------------------------------------------------------------
describe('computeProxyFlags — P7: impossible movement speed', () => {
  // Neutralise all rules except Rule 3 (speed check):
  //   - accuracy = 50 m  → in [1, 500], so Rules 1 & 2 don't fire
  //   - sameSessionAttendance = []  → Rule 4 doesn't fire
  //   - faceMatchScore = 1.0  → Rule 5 doesn't fire
  const SAFE_ACCURACY = 50;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * P7a: When speed > 30 m/s AND timeDiff is in (0, 3600) seconds,
   * suspicious_flag must be true.
   *
   * Strategy:
   *   1. Generate a "previous" lat/lng and a small lat offset to create a
   *      "current" position with a known distance.
   *   2. Compute the haversine distance d between the two points.
   *   3. Choose timeDiff = d / 31 so that speed = 31 m/s > 30 m/s.
   *      Clamp timeDiff to (0, 3600) — if d/31 >= 3600 the distance is too
   *      large for the window, so skip via fc.pre().
   *   4. Mock Date.now() so that nowTime - prevTime = timeDiff * 1000.
   *
   * Validates: Requirement 9.3 (positive case)
   */
  it('P7a: flags suspicious when speed > 30 m/s within 1-hour window', () => {
    fc.assert(
      fc.property(
        // Previous position: any valid lat/lng
        fc.double({ min: -80, max: 80, noNaN: true }),   // prevLat
        fc.double({ min: -179, max: 179, noNaN: true }), // prevLng
        // Latitude offset to create a non-zero distance (0.001° ≈ 111 m)
        fc.double({ min: 0.001, max: 0.5, noNaN: true }), // latOffset
        (prevLat, prevLng, latOffset) => {
          const prevCoords = { latitude: prevLat, longitude: prevLng };
          const currCoords = { latitude: prevLat + latOffset, longitude: prevLng };

          const distMetres = haversineMetres(prevCoords, currCoords);

          // timeDiff that yields speed = 31 m/s (just above threshold)
          const timeDiffSeconds = distMetres / 31;

          // Skip if timeDiff is outside the 1-hour window or zero
          fc.pre(timeDiffSeconds > 0 && timeDiffSeconds < 3600);

          const prevTime = 1_000_000_000_000; // arbitrary epoch ms
          const nowTime = prevTime + timeDiffSeconds * 1000;

          jest.spyOn(Date, 'now').mockReturnValue(nowTime);

          const prevSignedAt = new Date(prevTime).toISOString();

          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords: currCoords,
            lastAttendance: { lat: prevLat, lng: prevLng, signed_at: prevSignedAt },
            sameSessionAttendance: [],
            faceMatchScore: 1.0,
          });

          return result.suspicious_flag === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P7b: When speed ≤ 30 m/s (and timeDiff is in (0, 3600)), the speed
   * check alone must NOT set suspicious_flag = true.
   *
   * Strategy:
   *   1. Generate prev/curr coords with a known distance d.
   *   2. Choose timeDiff = d / 29 so that speed = 29 m/s ≤ 30 m/s.
   *      Skip via fc.pre() if timeDiff >= 3600 (outside window).
   *
   * Validates: Requirement 9.3 (negative case — slow speed)
   */
  it('P7b: does NOT flag suspicious when speed ≤ 30 m/s within 1-hour window', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        fc.double({ min: 0.0001, max: 0.05, noNaN: true }), // small offset → short distance
        (prevLat, prevLng, latOffset) => {
          const prevCoords = { latitude: prevLat, longitude: prevLng };
          const currCoords = { latitude: prevLat + latOffset, longitude: prevLng };

          const distMetres = haversineMetres(prevCoords, currCoords);

          // timeDiff that yields speed = 29 m/s (just below threshold)
          const timeDiffSeconds = distMetres / 29;

          // Skip if outside the 1-hour window
          fc.pre(timeDiffSeconds > 0 && timeDiffSeconds < 3600);

          const prevTime = 1_000_000_000_000;
          const nowTime = prevTime + timeDiffSeconds * 1000;

          jest.spyOn(Date, 'now').mockReturnValue(nowTime);

          const prevSignedAt = new Date(prevTime).toISOString();

          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords: currCoords,
            lastAttendance: { lat: prevLat, lng: prevLng, signed_at: prevSignedAt },
            sameSessionAttendance: [],
            faceMatchScore: 1.0,
          });

          return result.suspicious_flag === false && result.proxy_reason === '';
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P7c: When timeDiff ≥ 3600 seconds (outside the 1-hour window), the
   * speed check must NOT fire regardless of how fast the movement appears.
   *
   * Strategy:
   *   1. Generate prev/curr coords with a large distance (fast apparent speed).
   *   2. Set timeDiff to a value ≥ 3600 s.
   *
   * Validates: Requirement 9.3 (negative case — outside time window)
   */
  it('P7c: does NOT flag suspicious when timeDiff ≥ 3600 s (outside 1-hour window)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        fc.double({ min: 0.001, max: 0.5, noNaN: true }), // non-zero distance
        // timeDiff in [3600, 86400] seconds (1 hour to 1 day)
        fc.double({ min: 3600, max: 86_400, noNaN: true }),
        (prevLat, prevLng, latOffset, timeDiffSeconds) => {
          const prevCoords = { latitude: prevLat, longitude: prevLng };
          const currCoords = { latitude: prevLat + latOffset, longitude: prevLng };

          const prevTime = 1_000_000_000_000;
          const nowTime = prevTime + timeDiffSeconds * 1000;

          jest.spyOn(Date, 'now').mockReturnValue(nowTime);

          const prevSignedAt = new Date(prevTime).toISOString();

          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords: currCoords,
            lastAttendance: { lat: prevLat, lng: prevLng, signed_at: prevSignedAt },
            sameSessionAttendance: [],
            faceMatchScore: 1.0,
          });

          return result.suspicious_flag === false && result.proxy_reason === '';
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P7d: When lastAttendance is null, the speed check cannot fire.
   * Validates: Requirement 9.3 (no prior record)
   */
  it('P7d: does NOT flag suspicious when lastAttendance is null', () => {
    const result = computeProxyFlags({
      accuracy: SAFE_ACCURACY,
      currentCoords: { latitude: 1.3521, longitude: 103.8198 },
      lastAttendance: null,
      sameSessionAttendance: [],
      faceMatchScore: 1.0,
    });
    expect(result.suspicious_flag).toBe(false);
    expect(result.proxy_reason).toBe('');
  });

  /**
   * P7e: Boundary — speed just below 30 m/s must NOT be flagged.
   * Uses a concrete example: distance ≈ 300 m, timeDiff chosen so that
   * speed = dist / timeDiff < 30 m/s (timeDiff slightly longer than dist/30).
   *
   * Note: We avoid testing speed == exactly 30 m/s because floating-point
   * arithmetic in the haversine formula can cause the computed speed to
   * differ from the intended value by a tiny epsilon. Instead we test a
   * speed of 29.9 m/s which is unambiguously below the 30 m/s threshold.
   */
  it('P7e: boundary — speed just below 30 m/s (29.9 m/s) is not flagged', () => {
    const prevLat = 0;
    const prevLng = 0;
    const latOffset = 0.002695; // ≈ 300 m at equator
    const currCoords = { latitude: prevLat + latOffset, longitude: prevLng };
    const distMetres = haversineMetres({ latitude: prevLat, longitude: prevLng }, currCoords);

    // timeDiff = dist / 29.9 → speed ≈ 29.9 m/s (strictly below 30)
    const timeDiffSeconds = distMetres / 29.9;

    const prevTime = 1_000_000_000_000;
    const nowTime = prevTime + timeDiffSeconds * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(nowTime);

    const result = computeProxyFlags({
      accuracy: SAFE_ACCURACY,
      currentCoords: currCoords,
      lastAttendance: {
        lat: prevLat,
        lng: prevLng,
        signed_at: new Date(prevTime).toISOString(),
      },
      sameSessionAttendance: [],
      faceMatchScore: 1.0,
    });

    expect(result.suspicious_flag).toBe(false);
    expect(result.proxy_reason).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Property 8: Proxy flag — location collision
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------
describe('computeProxyFlags — P8: location collision', () => {
  // Neutralise all rules except Rule 4 (collision check):
  //   - accuracy = 50 m  → in [1, 500], so Rules 1 & 2 don't fire
  //   - lastAttendance = null  → Rule 3 (speed) doesn't fire
  //   - faceMatchScore = 1.0  → Rule 5 doesn't fire
  const SAFE_ACCURACY = 50;

  /**
   * P8a: When at least one same-session record is within 2 m of the current
   * student's coordinates, suspicious_flag must be true and the reason must
   * mention "possible proxy".
   *
   * Strategy:
   *   1. Generate a current lat/lng.
   *   2. Generate a tiny offset (< 0.000018°) so the haversine distance is
   *      well under 2 m (0.000018° ≈ 2 m at the equator; we use max 0.000010°
   *      ≈ 1.1 m to stay safely inside the 2 m threshold).
   *   3. Optionally prepend some "far" records to ensure the collision record
   *      can appear anywhere in the array.
   *
   * Validates: Requirement 9.4 (positive case)
   */
  it('P8a: flags suspicious when a same-session record is within 2 m', () => {
    fc.assert(
      fc.property(
        // Current position
        fc.double({ min: -80, max: 80, noNaN: true }),    // currentLat
        fc.double({ min: -179, max: 179, noNaN: true }),  // currentLng
        // Tiny offset that keeps the collision record within ~1.1 m
        fc.double({ min: 0, max: 0.000010, noNaN: true }), // latOffset
        fc.double({ min: 0, max: 0.000010, noNaN: true }), // lngOffset
        // Number of "far" records to prepend (0–4)
        fc.integer({ min: 0, max: 4 }),
        (currentLat, currentLng, latOffset, lngOffset, farCount) => {
          const currentCoords = { latitude: currentLat, longitude: currentLng };

          // The collision record — within ~1.1 m of currentCoords
          const collisionRecord = {
            lat: currentLat + latOffset,
            lng: currentLng + lngOffset,
          };

          // "Far" records — offset by 0.001° ≈ 111 m, well beyond 2 m
          const farRecords = Array.from({ length: farCount }, (_, i) => ({
            lat: currentLat + 0.001 * (i + 1),
            lng: currentLng + 0.001 * (i + 1),
          }));

          const sameSessionAttendance = [...farRecords, collisionRecord];

          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords,
            lastAttendance: null,
            sameSessionAttendance,
            faceMatchScore: 1.0,
          });

          return (
            result.suspicious_flag === true &&
            result.proxy_reason.includes('possible proxy')
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P8b: When all same-session records are more than 2 m away, the collision
   * check alone must NOT set suspicious_flag = true.
   *
   * Strategy:
   *   1. Generate a current lat/lng.
   *   2. Generate records offset by at least 0.00002° ≈ 2.2 m (safely > 2 m).
   *
   * Validates: Requirement 9.4 (negative case)
   */
  it('P8b: does NOT flag suspicious when all same-session records are > 2 m away', () => {
    fc.assert(
      fc.property(
        // Current position
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        // Array of 1–5 "far" records, each offset by at least 0.00002° ≈ 2.2 m
        fc.array(
          fc.record({
            latOffset: fc.double({ min: 0.00002, max: 0.01, noNaN: true }),
            lngOffset: fc.double({ min: 0.00002, max: 0.01, noNaN: true }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (currentLat, currentLng, offsets) => {
          const currentCoords = { latitude: currentLat, longitude: currentLng };

          const sameSessionAttendance = offsets.map(({ latOffset, lngOffset }) => ({
            lat: currentLat + latOffset,
            lng: currentLng + lngOffset,
          }));

          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords,
            lastAttendance: null,
            sameSessionAttendance,
            faceMatchScore: 1.0,
          });

          return result.suspicious_flag === false && result.proxy_reason === '';
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P8c: An empty sameSessionAttendance array must never trigger the
   * collision rule.
   *
   * Validates: Requirement 9.4 (edge case — no other students)
   */
  it('P8c: does NOT flag suspicious when sameSessionAttendance is empty', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        (lat, lng) => {
          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords: { latitude: lat, longitude: lng },
            lastAttendance: null,
            sameSessionAttendance: [],
            faceMatchScore: 1.0,
          });
          return result.suspicious_flag === false && result.proxy_reason === '';
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P8d: Records with null lat or null lng must be skipped and must NOT
   * trigger the collision rule, even if the non-null coordinate happens to
   * match the current position.
   *
   * Validates: Requirement 9.4 (null-coordinate records are ignored)
   */
  it('P8d: does NOT flag suspicious when same-session records have null lat/lng', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        // Mix of null-lat, null-lng, and both-null records
        fc.array(
          fc.oneof(
            fc.constant({ lat: null, lng: null }),
            fc.record({
              lat: fc.constant(null as null),
              lng: fc.double({ min: -179, max: 179, noNaN: true }),
            }),
            fc.record({
              lat: fc.double({ min: -80, max: 80, noNaN: true }),
              lng: fc.constant(null as null),
            }),
          ),
          { minLength: 1, maxLength: 5 },
        ),
        (lat, lng, nullRecords) => {
          const result = computeProxyFlags({
            accuracy: SAFE_ACCURACY,
            currentCoords: { latitude: lat, longitude: lng },
            lastAttendance: null,
            sameSessionAttendance: nullRecords,
            faceMatchScore: 1.0,
          });
          return result.suspicious_flag === false && result.proxy_reason === '';
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P8e: Boundary — a record at exactly 0 m distance (identical coordinates)
   * must trigger the collision rule (distance < 2 m).
   *
   * Validates: Requirement 9.4 (exact match is the clearest collision case)
   */
  it('P8e: boundary — identical coordinates (0 m) triggers the collision rule', () => {
    const currentCoords = { latitude: 1.3521, longitude: 103.8198 };
    const result = computeProxyFlags({
      accuracy: SAFE_ACCURACY,
      currentCoords,
      lastAttendance: null,
      sameSessionAttendance: [{ lat: currentCoords.latitude, lng: currentCoords.longitude }],
      faceMatchScore: 1.0,
    });
    expect(result.suspicious_flag).toBe(true);
    expect(result.proxy_reason).toBe(
      'Location matches another student exactly — possible proxy',
    );
  });
});
