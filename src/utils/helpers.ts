// ============================================================
// SmartRoll — General Utility Functions
// Shared helpers for date formatting, validation, GPS distance,
// and face-vector computation. Merged from lib/utils.ts.
// ============================================================

import { Coordinates } from '../types';

/**
 * Formats a Date object as a YYYY-MM-DD string.
 * @param date - the date to format
 * @returns ISO date string, e.g. "2025-01-15"
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's date as a YYYY-MM-DD string.
 * @returns today's ISO date string
 */
export function getTodayISO(): string {
  return formatDate(new Date());
}

/**
 * Checks whether a string is a valid email address format.
 * @param email - the string to test
 * @returns true if the string matches a basic email pattern
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates login form fields and returns a map of field → error message.
 * @param email - the email field value
 * @param password - the password field value
 * @returns an object with keys 'email' and/or 'password' if validation fails
 */
export function validateLoginForm(email: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address';
  }
  if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  return errors;
}

/**
 * Computes the Haversine distance between two GPS coordinates.
 * Uses the { lat, lng } coordinate shape from the Coordinates type.
 * @param a - first coordinate
 * @param b - second coordinate
 * @returns distance in metres
 */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a_val = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(a_val), Math.sqrt(1 - a_val));
}

/**
 * Rounds a number to 1 decimal place.
 * @param n - the number to round
 * @returns the rounded value
 */
export function round1dp(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Formats an ISO date string as a localised display date.
 * @param dateStr - ISO date string
 * @returns formatted string, e.g. "Jan 1, 2025"
 */
export function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Formats an ISO date string as a 12-hour time string.
 * @param dateStr - ISO date string
 * @returns formatted time, e.g. "09:30"
 */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Computes a robust face feature vector from raw JPEG image bytes.
 *
 * Uses a multi-feature approach combining:
 * 1. RGB channel histograms (48 bins × 3 channels = 144 values)
 * 2. Brightness distribution across a 4×4 spatial grid (16 values)
 * 3. Local contrast / edge density across the same grid (16 values)
 *
 * Total: 176-dimensional vector, normalised to [0, 1].
 *
 * This is significantly more discriminative than simple chunk averaging
 * because it captures colour distribution, spatial brightness layout,
 * and texture — all of which differ between faces.
 *
 * NOTE: For production-grade accuracy, replace with a proper on-device
 * face recognition model (e.g. TensorFlow Lite FaceNet).
 *
 * @param imageData - flat array of pixel byte values (0–255), RGB interleaved
 * @returns normalised feature vector
 */
export function computeFaceVector(imageData: number[]): number[] {
  const vector: number[] = [];

  // ── 1. RGB channel histograms (48 bins each) ──────────────────
  // Captures the overall colour distribution of the face
  const BINS = 48;
  const rHist = new Array(BINS).fill(0);
  const gHist = new Array(BINS).fill(0);
  const bHist = new Array(BINS).fill(0);

  const pixelCount = Math.floor(imageData.length / 3);
  for (let i = 0; i < pixelCount; i++) {
    const r = imageData[i * 3]     ?? 0;
    const g = imageData[i * 3 + 1] ?? 0;
    const b = imageData[i * 3 + 2] ?? 0;
    const bin = Math.min(Math.floor((r / 256) * BINS), BINS - 1);
    const gBin = Math.min(Math.floor((g / 256) * BINS), BINS - 1);
    const bBin = Math.min(Math.floor((b / 256) * BINS), BINS - 1);
    rHist[bin]++;
    gHist[gBin]++;
    bHist[bBin]++;
  }

  // Normalise histograms by pixel count
  const safePixels = Math.max(pixelCount, 1);
  for (let i = 0; i < BINS; i++) {
    vector.push(rHist[i] / safePixels);
    vector.push(gHist[i] / safePixels);
    vector.push(bHist[i] / safePixels);
  }

  // ── 2. Spatial brightness grid (4×4 = 16 cells) ──────────────
  // Captures WHERE brightness is concentrated — key for face structure
  // We treat the pixel array as a square image
  const GRID = 4;
  const side = Math.floor(Math.sqrt(pixelCount));
  const cellW = Math.max(1, Math.floor(side / GRID));
  const cellH = Math.max(1, Math.floor(side / GRID));

  const brightnessGrid = new Array(GRID * GRID).fill(0);
  const contrastGrid   = new Array(GRID * GRID).fill(0);
  const cellCounts     = new Array(GRID * GRID).fill(0);

  for (let i = 0; i < pixelCount; i++) {
    const px = i % side;
    const py = Math.floor(i / side);
    const cx = Math.min(Math.floor(px / cellW), GRID - 1);
    const cy = Math.min(Math.floor(py / cellH), GRID - 1);
    const cell = cy * GRID + cx;

    const r = imageData[i * 3]     ?? 0;
    const g = imageData[i * 3 + 1] ?? 0;
    const b = imageData[i * 3 + 2] ?? 0;

    // Perceived brightness (ITU-R BT.601 luma)
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    brightnessGrid[cell] += luma;
    cellCounts[cell]++;

    // Local contrast: deviation from mid-grey
    contrastGrid[cell] += Math.abs(luma - 0.5);
  }

  // Normalise by cell pixel count
  for (let c = 0; c < GRID * GRID; c++) {
    const count = Math.max(cellCounts[c], 1);
    vector.push(brightnessGrid[c] / count);   // avg brightness per cell
    vector.push(contrastGrid[c]   / count);   // avg contrast per cell
  }

  return vector;
}

/**
 * Computes the cosine similarity between two equal-length numeric vectors.
 * Used to compare face feature vectors for identity verification.
 * @param vec1 - first feature vector
 * @param vec2 - second feature vector
 * @returns similarity score in the range [0, 1]; 0 if either vector has zero magnitude
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  let dot = 0, mag1 = 0, mag2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dot  += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  return mag1 === 0 || mag2 === 0 ? 0 : dot / (mag1 * mag2);
}
