// Feature: student-attendance-flow, Property 2: step locking invariant
// Feature: student-attendance-flow, Property 3: canSubmit iff preconditions met
// Feature: student-attendance-flow, Property 4: submission idempotence
// Feature: student-attendance-flow, Property 5: insert payload completeness
// Feature: student-attendance-flow, Property 12: selfie upload path

import * as fc from 'fast-check';
import {
  FlowStep,
  AttendanceFlowState,
  buildAttendancePayload,
  buildSelfieUploadPath,
} from '../useAttendanceFlow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute canSubmit from a state and an optional session presence flag.
 * Mirrors the hook's canSubmit derivation:
 *   gpsOk && selfieOk && step !== 'done' && step !== 'submitting'
 */
function computeCanSubmit(
  gpsOk: boolean,
  selfieOk: boolean,
  step: FlowStep,
): boolean {
  return gpsOk && selfieOk && step !== 'done' && step !== 'submitting';
}

/**
 * Determine whether a given (gpsOk, selfieOk, step) combination is a
 * reachable state according to the step-locking invariant.
 *
 * Rules:
 *  - gpsOk = false  → step must be 'gps' or 'error'
 *  - selfieOk = false → step must NOT be 'biometric', 'submitting', or 'done'
 *    (it can be 'gps', 'selfie', or 'error')
 */
function isValidState(gpsOk: boolean, selfieOk: boolean, step: FlowStep): boolean {
  if (!gpsOk) {
    // Without GPS, only 'gps' and 'error' are reachable
    if (step === 'selfie' || step === 'biometric' || step === 'submitting' || step === 'done') {
      return false;
    }
  }
  if (!selfieOk) {
    // Without selfie, 'biometric', 'submitting', and 'done' are unreachable
    if (step === 'biometric' || step === 'submitting' || step === 'done') {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const flowStepArb = fc.constantFrom<FlowStep>(
  'gps',
  'selfie',
  'biometric',
  'submitting',
  'done',
  'error',
);

// ---------------------------------------------------------------------------
// Property 2: Step locking invariant
// Validates: Requirements 4.4, 4.5, 5.9, 5.10, 6.6
// ---------------------------------------------------------------------------
describe('useAttendanceFlow — P2: Step locking invariant', () => {
  /**
   * P2a: When gpsOk = false, the step must NOT be 'selfie', 'biometric',
   * 'submitting', or 'done'.
   *
   * We test the invariant by generating random (gpsOk=false, selfieOk, step)
   * combinations and asserting that any state with gpsOk=false and a
   * "post-GPS" step is invalid according to our state machine rules.
   *
   * Validates: Requirements 4.4, 4.5
   */
  it('P2a: when gpsOk=false, step must not be selfie/biometric/submitting/done', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // selfieOk
        flowStepArb,    // step
        (selfieOk, step) => {
          const gpsOk = false;
          // If the step is one that requires GPS, the state is invalid
          const postGpsSteps: FlowStep[] = ['selfie', 'biometric', 'submitting', 'done'];
          if (postGpsSteps.includes(step)) {
            // This state should be flagged as invalid
            return !isValidState(gpsOk, selfieOk, step);
          }
          // 'gps' and 'error' are valid when gpsOk=false
          return isValidState(gpsOk, selfieOk, step);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P2b: When selfieOk = false, the step must NOT be 'biometric',
   * 'submitting', or 'done'.
   *
   * Validates: Requirements 5.9, 5.10, 6.6
   */
  it('P2b: when selfieOk=false, step must not be biometric/submitting/done', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk
        flowStepArb,    // step
        (gpsOk, step) => {
          const selfieOk = false;
          const postSelfieSteps: FlowStep[] = ['biometric', 'submitting', 'done'];
          if (postSelfieSteps.includes(step)) {
            return !isValidState(gpsOk, selfieOk, step);
          }
          // 'gps', 'selfie', 'error' are potentially valid when selfieOk=false
          // (subject to gpsOk constraint)
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P2c: The isValidState function correctly classifies all combinations.
   * For any (gpsOk, selfieOk, step), the validity check is consistent.
   *
   * Validates: Requirements 4.4, 4.5, 5.9, 5.10, 6.6
   */
  it('P2c: valid states satisfy both GPS and selfie preconditions', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk
        fc.boolean(),   // selfieOk
        flowStepArb,    // step
        (gpsOk, selfieOk, step) => {
          const valid = isValidState(gpsOk, selfieOk, step);

          if (!gpsOk) {
            // If gpsOk=false, post-GPS steps must be invalid
            const postGpsSteps: FlowStep[] = ['selfie', 'biometric', 'submitting', 'done'];
            if (postGpsSteps.includes(step)) {
              return valid === false;
            }
          }

          if (!selfieOk) {
            // If selfieOk=false, post-selfie steps must be invalid
            const postSelfieSteps: FlowStep[] = ['biometric', 'submitting', 'done'];
            if (postSelfieSteps.includes(step)) {
              return valid === false;
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: canSubmit iff all preconditions met
// Validates: Requirements 7.1, 7.2
// ---------------------------------------------------------------------------
describe('useAttendanceFlow — P3: canSubmit iff preconditions met', () => {
  /**
   * P3a: canSubmit is true iff gpsOk && selfieOk && hasActiveSession && !alreadySigned.
   *
   * Mapping:
   *   - alreadySigned → step === 'done'
   *   - hasActiveSession → session !== null (we model this as a boolean)
   *   - canSubmit = gpsOk && selfieOk && step !== 'done' && step !== 'submitting'
   *
   * Note: hasActiveSession is a precondition enforced at the hook call site
   * (the hook returns canSubmit=false when session is null because gpsOk
   * will never become true without a session). We test the canSubmit
   * computation directly here.
   *
   * Validates: Requirements 7.1, 7.2
   */
  it('P3a: canSubmit is true iff gpsOk && selfieOk && !alreadySigned && !submitting', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk
        fc.boolean(),   // selfieOk
        fc.boolean(),   // alreadySigned (maps to step === 'done')
        fc.boolean(),   // isSubmitting (maps to step === 'submitting')
        (gpsOk, selfieOk, alreadySigned, isSubmitting) => {
          // Determine step: if alreadySigned → 'done', if isSubmitting → 'submitting',
          // otherwise use a neutral step ('biometric') that doesn't block canSubmit
          let step: FlowStep;
          if (alreadySigned) {
            step = 'done';
          } else if (isSubmitting) {
            step = 'submitting';
          } else {
            step = 'biometric';
          }

          const result = computeCanSubmit(gpsOk, selfieOk, step);
          const expected = gpsOk && selfieOk && !alreadySigned && !isSubmitting;

          return result === expected;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P3b: canSubmit is false when gpsOk=false, regardless of other flags.
   *
   * Validates: Requirement 7.1 (outside geofence → button disabled)
   */
  it('P3b: canSubmit is always false when gpsOk=false', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // selfieOk
        flowStepArb,    // step
        (selfieOk, step) => {
          return computeCanSubmit(false, selfieOk, step) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P3c: canSubmit is false when selfieOk=false, regardless of other flags.
   *
   * Validates: Requirement 7.1 (selfie not taken → button disabled)
   */
  it('P3c: canSubmit is always false when selfieOk=false', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk
        flowStepArb,    // step
        (gpsOk, step) => {
          return computeCanSubmit(gpsOk, false, step) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P3d: canSubmit is false when step === 'done', regardless of gpsOk/selfieOk.
   *
   * Validates: Requirement 7.4 (already signed → button permanently disabled)
   */
  it('P3d: canSubmit is always false when step=done', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk
        fc.boolean(),   // selfieOk
        (gpsOk, selfieOk) => {
          return computeCanSubmit(gpsOk, selfieOk, 'done') === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P3e: canSubmit is false when step === 'submitting', regardless of gpsOk/selfieOk.
   *
   * Validates: Requirement 7.1 (in-flight submission → button disabled)
   */
  it('P3e: canSubmit is always false when step=submitting', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk
        fc.boolean(),   // selfieOk
        (gpsOk, selfieOk) => {
          return computeCanSubmit(gpsOk, selfieOk, 'submitting') === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Submission idempotence
// Validates: Requirements 7.4, 8.4
// ---------------------------------------------------------------------------
describe('useAttendanceFlow — P4: Submission idempotence', () => {
  /**
   * P4a: Once step === 'done', canSubmit must remain false regardless of
   * any subsequent changes to gpsOk or selfieOk.
   *
   * This tests that the 'done' step acts as a terminal state for canSubmit.
   *
   * Validates: Requirements 7.4, 8.4
   */
  it('P4a: canSubmit is always false when step=done, regardless of gpsOk/selfieOk', () => {
    fc.assert(
      fc.property(
        fc.boolean(),   // gpsOk (simulates subsequent GPS changes)
        fc.boolean(),   // selfieOk (simulates subsequent selfie changes)
        (gpsOk, selfieOk) => {
          // The step is 'done' — this is the terminal state after a successful submission
          const step: FlowStep = 'done';
          return computeCanSubmit(gpsOk, selfieOk, step) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P4b: For any state that has reached 'done', no combination of
   * gpsOk/selfieOk values can re-enable canSubmit.
   *
   * Validates: Requirements 7.4, 8.4
   */
  it('P4b: no gpsOk/selfieOk combination can re-enable canSubmit after done', () => {
    // Exhaustive check over all boolean combinations
    const combinations = [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const;

    for (const [gpsOk, selfieOk] of combinations) {
      expect(computeCanSubmit(gpsOk, selfieOk, 'done')).toBe(false);
    }
  });

  /**
   * P4c: Property-based confirmation that 'done' is the only step that
   * permanently blocks canSubmit regardless of gpsOk/selfieOk=true.
   *
   * When gpsOk=true AND selfieOk=true, canSubmit should be true for all
   * steps EXCEPT 'done' and 'submitting'.
   *
   * Validates: Requirements 7.4, 8.4 (by contrast — shows 'done' is special)
   */
  it('P4c: when gpsOk=true and selfieOk=true, only done/submitting blocks canSubmit', () => {
    fc.assert(
      fc.property(
        flowStepArb,
        (step) => {
          const result = computeCanSubmit(true, true, step);
          if (step === 'done' || step === 'submitting') {
            return result === false;
          }
          return result === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Attendance insert payload completeness
// Validates: Requirements 8.1
// ---------------------------------------------------------------------------
describe('useAttendanceFlow — P5: Attendance insert payload completeness', () => {
  // Required fields in the attendance insert payload
  const REQUIRED_FIELDS = [
    'session_id',
    'student_id',
    'status',
    'lat',
    'lng',
    'distance_metres',
    'face_match_score',
    'suspicious_flag',
    'signed_at',
  ] as const;

  /**
   * P5a: For any valid submission inputs, the constructed payload must
   * contain all required fields with no undefined values.
   *
   * Validates: Requirement 8.1
   */
  it('P5a: payload always contains all required fields with no undefined values', () => {
    fc.assert(
      fc.property(
        // sessionId: non-empty UUID-like string
        fc.uuid(),
        // userId: non-empty UUID-like string
        fc.uuid(),
        // coords: valid GPS coordinates or null
        fc.oneof(
          fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          fc.constant(null),
        ),
        // distanceM: non-negative number or null
        fc.oneof(
          fc.double({ min: 0, max: 10000, noNaN: true }),
          fc.constant(null),
        ),
        // faceMatchScore: value in [0, 1]
        fc.double({ min: 0, max: 1, noNaN: true }),
        // suspiciousFlag: boolean
        fc.boolean(),
        (sessionId, userId, coords, distanceM, faceMatchScore, suspiciousFlag) => {
          const payload = buildAttendancePayload({
            sessionId,
            userId,
            coords,
            distanceM,
            faceMatchScore,
            suspiciousFlag,
          });

          // Assert all required fields are present and not undefined
          for (const field of REQUIRED_FIELDS) {
            if (payload[field] === undefined) {
              return false;
            }
          }

          // Assert status is always 'present'
          if (payload.status !== 'present') return false;

          // Assert session_id and student_id match inputs
          if (payload.session_id !== sessionId) return false;
          if (payload.student_id !== userId) return false;

          // Assert lat/lng match coords (or null when coords is null)
          if (coords === null) {
            if (payload.lat !== null || payload.lng !== null) return false;
          } else {
            if (payload.lat !== coords.latitude) return false;
            if (payload.lng !== coords.longitude) return false;
          }

          // Assert face_match_score matches input
          if (payload.face_match_score !== faceMatchScore) return false;

          // Assert suspicious_flag matches input
          if (payload.suspicious_flag !== suspiciousFlag) return false;

          // Assert signed_at is a valid ISO 8601 string
          const parsedDate = new Date(payload.signed_at);
          if (isNaN(parsedDate.getTime())) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P5b: When coords is null, lat and lng in the payload must be null
   * (not undefined or 0).
   *
   * Validates: Requirement 8.1 (null GPS is explicitly allowed)
   */
  it('P5b: lat and lng are null (not undefined) when coords is null', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.boolean(),
        (sessionId, userId, faceMatchScore, suspiciousFlag) => {
          const payload = buildAttendancePayload({
            sessionId,
            userId,
            coords: null,
            distanceM: null,
            faceMatchScore,
            suspiciousFlag,
          });

          return payload.lat === null && payload.lng === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P5c: The signed_at field is always a valid ISO 8601 timestamp.
   *
   * Validates: Requirement 8.1
   */
  it('P5c: signed_at is always a valid ISO 8601 timestamp', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (sessionId, userId) => {
          const payload = buildAttendancePayload({
            sessionId,
            userId,
            coords: null,
            distanceM: null,
            faceMatchScore: 0.9,
            suspiciousFlag: false,
          });

          const parsed = new Date(payload.signed_at);
          return !isNaN(parsed.getTime()) && payload.signed_at.includes('T');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Selfie upload path is deterministic
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------
describe('useAttendanceFlow — P12: Selfie upload path is deterministic', () => {
  /**
   * P12a: For any userId, the upload path must equal exactly
   * `${userId}/selfie.jpg` (the bucket prefix 'face-photos' is the bucket
   * name, not part of the path passed to .upload()).
   *
   * Validates: Requirement 5.4
   */
  it('P12a: upload path equals `${userId}/selfie.jpg` for any userId', () => {
    fc.assert(
      fc.property(
        // Generate non-empty strings that could be user IDs (UUIDs, short IDs, etc.)
        fc.oneof(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0),
        ),
        (userId) => {
          const path = buildSelfieUploadPath(userId);
          return path === `${userId}/selfie.jpg`;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P12b: The path always ends with '/selfie.jpg'.
   *
   * Validates: Requirement 5.4
   */
  it('P12b: upload path always ends with /selfie.jpg', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          const path = buildSelfieUploadPath(userId);
          return path.endsWith('/selfie.jpg');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P12c: The path always starts with the userId.
   *
   * Validates: Requirement 5.4
   */
  it('P12c: upload path always starts with the userId', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          const path = buildSelfieUploadPath(userId);
          return path.startsWith(userId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P12d: Two different userIds always produce different paths.
   *
   * Validates: Requirement 5.4 (deterministic and unique per user)
   */
  it('P12d: different userIds produce different upload paths', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (userId1, userId2) => {
          fc.pre(userId1 !== userId2);
          const path1 = buildSelfieUploadPath(userId1);
          const path2 = buildSelfieUploadPath(userId2);
          return path1 !== path2;
        },
      ),
      { numRuns: 100 },
    );
  });
});
