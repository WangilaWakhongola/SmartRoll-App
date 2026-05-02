// ============================================================
// SmartRoll — Attendance Flow Constants
//
// Single source of truth for all magic numbers used across the
// attendance flow. Import from here instead of scattering
// literals through hooks, services, and components.
// ============================================================

// ── Face verification ─────────────────────────────────────────
/** Minimum cosine-similarity score to pass face verification */
export const FACE_MATCH_THRESHOLD = 0.65;

/** Number of dimensions in the simplified face feature vector */
export const FACE_VECTOR_DIMENSIONS = 128;

// ── Anti-proxy detection ──────────────────────────────────────
/** GPS accuracy below this value (metres) is treated as mocked GPS */
export const PROXY_GPS_ACCURACY_MIN_M = 1;

/** GPS accuracy above this value (metres) is treated as too weak */
export const PROXY_GPS_ACCURACY_MAX_M = 500;

/** Speed above this value (m/s) within the time window is impossible movement */
export const PROXY_MAX_SPEED_MPS = 30;

/** Time window (seconds) within which the speed check applies */
export const PROXY_SPEED_WINDOW_S = 3600; // 1 hour

/** Two attendance records within this distance (metres) are a location collision */
export const PROXY_COLLISION_RADIUS_M = 2;

// ── GPS polling ───────────────────────────────────────────────
/** Minimum time between GPS updates in milliseconds */
export const GPS_POLL_INTERVAL_MS = 10_000; // 10 seconds

/** Minimum distance change (metres) to trigger a GPS update */
export const GPS_DISTANCE_INTERVAL_M = 5;

// ── Auth / profile fetch ──────────────────────────────────────
/** Maximum number of profile fetch attempts after sign-up */
export const PROFILE_FETCH_MAX_RETRIES = 5;

/** Delay between profile fetch retries in milliseconds */
export const PROFILE_FETCH_RETRY_DELAY_MS = 700;

// ── Selfie capture ────────────────────────────────────────────
/** JPEG quality for selfie capture (0–1) */
export const SELFIE_JPEG_QUALITY = 0.7;

/** Countdown duration in seconds before the selfie is taken */
export const SELFIE_COUNTDOWN_S = 3;

// ── GPS ring animation ────────────────────────────────────────
/** Duration of one pulse animation cycle in milliseconds */
export const GPS_RING_PULSE_DURATION_MS = 1800;

/** Delay before the second ring starts pulsing in milliseconds */
export const GPS_RING_PULSE_STAGGER_MS = 600;

// ── Default geofence ──────────────────────────────────────────
/** Fallback geofence radius when the session row has no radius_metres */
export const DEFAULT_GEOFENCE_RADIUS_M = 50;
