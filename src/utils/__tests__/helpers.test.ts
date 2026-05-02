// Feature: student-attendance-flow, Property 9: cosine similarity

import * as fc from 'fast-check';
import { cosineSimilarity } from '../helpers';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Compute the Euclidean magnitude of a vector.
 */
function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * A float arbitrary that avoids subnormal values (values too close to zero
 * that cause floating-point underflow in magnitude computations).
 * We use the range [-1e100, -1e-10] ∪ [1e-10, 1e100] to ensure all values
 * are normal IEEE 754 doubles with well-defined arithmetic.
 */
const normalFloatArb: fc.Arbitrary<number> = fc.oneof(
  fc.double({ min: 1e-10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -1e10, max: -1e-10, noNaN: true, noDefaultInfinity: true }),
);

/**
 * Generate a non-zero float vector of a given length using normal floats.
 * All elements are in [-1e10, -1e-10] ∪ [1e-10, 1e10], guaranteeing that
 * the magnitude is always > 0 and cosine similarity is well-defined.
 */
function nonZeroVectorArb(length: number): fc.Arbitrary<number[]> {
  return fc.array(normalFloatArb, { minLength: length, maxLength: length });
}

/**
 * Generate a pair of non-zero equal-length vectors.
 * Length is chosen randomly in [1, 20].
 */
const nonZeroVectorPairArb: fc.Arbitrary<[number[], number[]]> = fc
  .integer({ min: 1, max: 20 })
  .chain((len) =>
    fc.tuple(nonZeroVectorArb(len), nonZeroVectorArb(len)),
  );

/**
 * Generate a single non-zero vector of random length [1, 20].
 */
const nonZeroVectorArb_: fc.Arbitrary<number[]> = fc
  .integer({ min: 1, max: 20 })
  .chain((len) => nonZeroVectorArb(len));

// ---------------------------------------------------------------------------
// Property 9: Cosine similarity range and identity
// Validates: Requirements 5.5
// ---------------------------------------------------------------------------
describe('cosineSimilarity — P9: cosine similarity range and identity', () => {
  /**
   * P9a: Result is always in [-1, 1] for any non-zero equal-length vectors.
   *
   * The cosine similarity is defined as dot(v1, v2) / (|v1| * |v2|).
   * By the Cauchy-Schwarz inequality this value is always in [-1, 1].
   *
   * Validates: Requirements 5.5
   */
  it('P9a: result is always in [-1, 1] for any non-zero equal-length vectors', () => {
    fc.assert(
      fc.property(nonZeroVectorPairArb, ([v1, v2]) => {
        const result = cosineSimilarity(v1, v2);
        return result >= -1 - 1e-9 && result <= 1 + 1e-9;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * P9b: cosineSimilarity(v, v) === 1.0 within tolerance 1e-9 for any
   * non-zero vector.
   *
   * A vector is perfectly similar to itself. The dot product of v with itself
   * equals |v|^2, so the result is |v|^2 / (|v| * |v|) = 1.
   *
   * Validates: Requirements 5.5
   */
  it('P9b: cosineSimilarity(v, v) === 1.0 within tolerance 1e-9 for any non-zero vector', () => {
    fc.assert(
      fc.property(nonZeroVectorArb_, (v) => {
        const result = cosineSimilarity(v, v);
        return Math.abs(result - 1.0) <= 1e-9;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * P9c: cosineSimilarity(v, -v) === -1.0 within tolerance 1e-9
   * (anti-parallel vectors).
   *
   * The negation of a vector points in the exact opposite direction.
   * dot(v, -v) = -|v|^2, so the result is -|v|^2 / (|v| * |-v|) = -1.
   *
   * Validates: Requirements 5.5
   */
  it('P9c: cosineSimilarity(v, -v) === -1.0 within tolerance 1e-9 (anti-parallel vectors)', () => {
    fc.assert(
      fc.property(nonZeroVectorArb_, (v) => {
        const negV = v.map((x) => -x);
        // Skip if negV is all zeros (e.g. v was all zeros — filtered by nonZeroVectorArb_
        // but -0 === 0 in JS, so negating a non-zero vector keeps it non-zero)
        const result = cosineSimilarity(v, negV);
        return Math.abs(result - (-1.0)) <= 1e-9;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * P9d: Returns 0 when either vector is all zeros.
   *
   * The implementation explicitly returns 0 when either magnitude is 0 to
   * avoid division by zero.
   *
   * Validates: Requirements 5.5 (zero-magnitude guard)
   */
  it('P9d: returns 0 when either vector is all zeros', () => {
    fc.assert(
      fc.property(
        // Length in [1, 20]
        fc.integer({ min: 1, max: 20 }),
        nonZeroVectorArb_,
        (len, nonZeroVec) => {
          const zeroVec = Array(len).fill(0);
          const nonZeroTrimmed = nonZeroVec.slice(0, len).concat(
            Array(Math.max(0, len - nonZeroVec.length)).fill(1),
          );

          const resultA = cosineSimilarity(zeroVec, nonZeroTrimmed);
          const resultB = cosineSimilarity(nonZeroTrimmed, zeroVec);
          const resultC = cosineSimilarity(zeroVec, zeroVec);

          return resultA === 0 && resultB === 0 && resultC === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * P9e: Result is symmetric: cosineSimilarity(a, b) === cosineSimilarity(b, a)
   * within tolerance 1e-9.
   *
   * The dot product and magnitudes are symmetric operations, so the order of
   * arguments must not affect the result.
   *
   * Validates: Requirements 5.5
   */
  it('P9e: result is symmetric: cosineSimilarity(a, b) === cosineSimilarity(b, a) within tolerance 1e-9', () => {
    fc.assert(
      fc.property(nonZeroVectorPairArb, ([a, b]) => {
        const ab = cosineSimilarity(a, b);
        const ba = cosineSimilarity(b, a);
        return Math.abs(ab - ba) <= 1e-9;
      }),
      { numRuns: 100 },
    );
  });
});
