// ============================================================
// SmartRoll — useAttendanceFlow
// State machine + submission logic for the 3-step attendance flow.
// Feature: student-attendance-flow
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { GeofenceService } from '../services/geofence.service';
import { BiometricService } from '../services/biometric.service';
import { computeProxyFlags } from '../utils/proxyDetection';
import { computeFaceVector, cosineSimilarity } from '../utils/helpers';
import { supabase } from '../services/supabase';
import { SessionItem } from './useStudentSessions';
import { FACE_MATCH_THRESHOLD } from '../constants/attendance';
import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────

export type FlowStep = 'gps' | 'selfie' | 'biometric' | 'submitting' | 'done' | 'error';

export interface AttendanceFlowState {
  step: FlowStep;
  gpsOk: boolean;
  selfieOk: boolean;
  selfieB64: string | null;
  distanceM: number | null;
  error: string | null;
}

export interface UseAttendanceFlowResult {
  state: AttendanceFlowState;
  /** gpsOk && selfieOk && step !== 'done' && step !== 'submitting' */
  canSubmit: boolean;
  showCamera: boolean;
  setShowCamera: (show: boolean) => void;
  openCamera: () => void;
  onSelfieCapture: (b64: string) => Promise<void>;
  submit: () => Promise<void>;
  reset: () => void;
}

// ── Initial state ─────────────────────────────────────────────

const INITIAL_STATE: AttendanceFlowState = {
  step: 'gps',
  gpsOk: false,
  selfieOk: false,
  selfieB64: null,
  distanceM: null,
  error: null,
};

// ── Helpers ───────────────────────────────────────────────────

/**
 * Build the attendance insert payload.
 * Exported as a pure function so it can be tested directly (P5).
 */
export function buildAttendancePayload(params: {
  sessionId: string;
  userId: string;
  coords: { latitude: number; longitude: number } | null;
  distanceM: number | null;
  faceMatchScore: number;
  suspiciousFlag: boolean;
}): {
  session_id: string;
  student_id: string;
  status: 'present';
  lat: number | null;
  lng: number | null;
  distance_metres: number | null;
  face_match_score: number;
  suspicious_flag: boolean;
  signed_at: string;
} {
  return {
    session_id: params.sessionId,
    student_id: params.userId,
    status: 'present',
    lat: params.coords?.latitude ?? null,
    lng: params.coords?.longitude ?? null,
    distance_metres: params.distanceM,
    face_match_score: params.faceMatchScore,
    suspicious_flag: params.suspiciousFlag,
    signed_at: new Date().toISOString(),
  };
}

/**
 * Build the Supabase Storage upload path for a selfie.
 * Exported as a pure function so it can be tested directly (P12).
 */
export function buildSelfieUploadPath(userId: string): string {
  return `${userId}/selfie.jpg`;
}

// ── Hook ──────────────────────────────────────────────────────

export function useAttendanceFlow(
  session: SessionItem | null,
  coords: { latitude: number; longitude: number; accuracy: number | null } | null,
  userId: string,
  facePhotoUrl: string | undefined,
): UseAttendanceFlowResult {
  const [state, setState] = useState<AttendanceFlowState>(INITIAL_STATE);
  const [showCamera, setShowCamera] = useState(false);

  // Track the last known faceMatchScore for the proxy check
  const faceMatchScoreRef = useRef<number>(1.0);

  // ── GPS effect: watch coords and re-evaluate geofence ────────
  useEffect(() => {
    if (!coords || !session) return;

    const fence = {
      latitude: session.latitude,
      longitude: session.longitude,
      radiusMeters: session.radiusMeters,
    };

    const distanceM = GeofenceService.distanceToFence(coords, fence);
    const inside = GeofenceService.isInsideGeofence(coords, fence);

    setState((prev) => {
      const nextGpsOk = inside;
      let nextStep = prev.step;

      // Auto-advance gps → selfie when gpsOk transitions to true
      if (nextGpsOk && !prev.gpsOk && prev.step === 'gps') {
        nextStep = 'selfie';
        logger.debug('useAttendanceFlow', 'GPS verified — advancing to selfie', { distanceM });
      }

      // If GPS drops out while on selfie step, go back to gps
      if (!nextGpsOk && prev.step === 'selfie' && !prev.selfieOk) {
        nextStep = 'gps';
        logger.debug('useAttendanceFlow', 'GPS lost — returning to gps step', { distanceM });
      }

      return {
        ...prev,
        gpsOk: nextGpsOk,
        distanceM,
        step: nextStep,
      };
    });
  }, [coords, session]);

  // ── openCamera ────────────────────────────────────────────────
  const openCamera = useCallback(() => {
    setShowCamera(true);
  }, []);

  // ── onSelfieCapture ───────────────────────────────────────────
  const onSelfieCapture = useCallback(
    async (b64: string) => {
      setState((prev) => ({ ...prev, error: null }));

      try {
        // 1. Convert base64 to Blob and upload to Supabase Storage
        const byteCharacters = atob(b64.replace(/^data:image\/\w+;base64,/, ''));
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        const uploadPath = buildSelfieUploadPath(userId);
        const { error: uploadError } = await supabase.storage
          .from('face-photos')
          .upload(uploadPath, blob, { upsert: true });

        if (uploadError) {
          logger.error('useAttendanceFlow', 'Selfie upload failed', uploadError);
          setState((prev) => ({
            ...prev,
            error: 'Face verification could not be completed. Please check your connection and try again.',
          }));
          return;
        }

        // 2. Fetch profile photo bytes
        const profilePath = `${userId}/profile.jpg`;
        const { data: profileBlob, error: downloadError } = await supabase.storage
          .from('face-photos')
          .download(profilePath);

        if (downloadError || !profileBlob) {
          logger.warn('useAttendanceFlow', 'Profile photo not found', { userId, downloadError });
          setState((prev) => ({
            ...prev,
            error: 'No profile photo found. Please update your profile first.',
          }));
          return;
        }

        // 3. Convert both images to pixel arrays and compute face vectors
        const selfieBytes = Array.from(byteArray);
        const profileArrayBuffer = await profileBlob.arrayBuffer();
        const profileBytes = Array.from(new Uint8Array(profileArrayBuffer));

        const selfieVector = computeFaceVector(selfieBytes);
        const profileVector = computeFaceVector(profileBytes);

        // 4. Compute cosine similarity score
        const score = cosineSimilarity(selfieVector, profileVector);
        faceMatchScoreRef.current = score;
        logger.debug('useAttendanceFlow', 'Face match score computed', { score, threshold: FACE_MATCH_THRESHOLD });

        if (score >= FACE_MATCH_THRESHOLD) {
          // Advance to biometric step
          setState((prev) => ({
            ...prev,
            step: 'biometric',
            selfieOk: true,
            selfieB64: b64,
            error: null,
          }));
        } else {
          const scorePercent = Math.round(score * 100);
          logger.warn('useAttendanceFlow', 'Face match failed', { scorePercent });
          setState((prev) => ({
            ...prev,
            selfieOk: false,
            error: `Face verification failed (score: ${scorePercent}%). Please retake your selfie.`,
          }));
        }
      } catch (err: any) {
        logger.error('useAttendanceFlow', 'onSelfieCapture unexpected error', err);
        setState((prev) => ({
          ...prev,
          error: 'Face verification could not be completed. Please check your connection and try again.',
        }));
      }

      setShowCamera(false);
    },
    [userId],
  );

  // ── submit ────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (!session) return;

    setState((prev) => ({ ...prev, step: 'submitting', error: null }));

    try {
      // 1. Trigger biometric authentication
      const biometricOk = await BiometricService.authenticate(
        'Confirm your identity to sign attendance',
      );

      if (!biometricOk) {
        logger.warn('useAttendanceFlow', 'Biometric authentication failed or cancelled');
        setState((prev) => ({
          ...prev,
          step: 'biometric',
          error: 'Biometric confirmation failed.',
        }));
        return;
      }

      // 2. Check for existing attendance record (UNIQUE constraint check)
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', session.sessionId)
        .eq('student_id', userId)
        .maybeSingle();

      if (existing) {
        setState((prev) => ({
          ...prev,
          step: 'done',
          error: 'Already signed',
        }));
        return;
      }

      // 3. Fetch data needed for proxy check
      const [lastAttendanceResult, sameSessionResult] = await Promise.all([
        supabase
          .from('attendance')
          .select('lat, lng, signed_at')
          .eq('student_id', userId)
          .order('signed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('lat, lng')
          .eq('session_id', session.sessionId),
      ]);

      const lastAttendance = lastAttendanceResult.data
        ? {
            lat: lastAttendanceResult.data.lat,
            lng: lastAttendanceResult.data.lng,
            signed_at: lastAttendanceResult.data.signed_at,
          }
        : null;

      const sameSessionAttendance = (sameSessionResult.data ?? []).map((r: any) => ({
        lat: r.lat,
        lng: r.lng,
      }));

      // 4. Compute proxy flags
      const faceMatchScore = faceMatchScoreRef.current;
      const proxyResult = computeProxyFlags({
        accuracy: coords?.accuracy ?? null,
        currentCoords: coords
          ? { latitude: coords.latitude, longitude: coords.longitude }
          : { latitude: 0, longitude: 0 },
        lastAttendance,
        sameSessionAttendance,
        faceMatchScore,
      });

      if (proxyResult.suspicious_flag) {
        logger.warn('useAttendanceFlow', 'Proxy flag set', { reason: proxyResult.proxy_reason });
      }

      // 5. Build and insert attendance payload
      const payload = buildAttendancePayload({
        sessionId: session.sessionId,
        userId,
        coords: coords ?? null,
        distanceM: state.distanceM,
        faceMatchScore,
        suspiciousFlag: proxyResult.suspicious_flag,
      });

      const { error: insertError } = await supabase.from('attendance').insert(payload);

      if (insertError) {
        // Check for duplicate (unique constraint violation)
        if (
          insertError.code === '23505' ||
          insertError.message?.toLowerCase().includes('duplicate') ||
          insertError.message?.toLowerCase().includes('unique')
        ) {
          logger.warn('useAttendanceFlow', 'Duplicate attendance record detected');
          setState((prev) => ({
            ...prev,
            step: 'done',
            error: 'Already signed',
          }));
        } else {
          logger.error('useAttendanceFlow', 'Attendance insert failed', insertError);
          setState((prev) => ({
            ...prev,
            step: 'biometric',
            error: insertError.message ?? 'Failed to submit attendance. Please try again.',
          }));
        }
        return;
      }

      // 6. Success
      logger.info('useAttendanceFlow', 'Attendance submitted successfully', { sessionId: session.sessionId });
      setState((prev) => ({
        ...prev,
        step: 'done',
        error: null,
      }));
    } catch (err: any) {
      logger.error('useAttendanceFlow', 'submit unexpected error', err);
      setState((prev) => ({
        ...prev,
        step: 'biometric',
        error: err?.message ?? 'Failed to submit attendance. Please try again.',
      }));
    }
  }, [session, userId, coords, state.distanceM]);

  // ── reset ─────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setShowCamera(false);
    faceMatchScoreRef.current = 1.0;
  }, []);

  // ── canSubmit ─────────────────────────────────────────────────
  const canSubmit =
    state.gpsOk &&
    state.selfieOk &&
    state.step !== 'done' &&
    state.step !== 'submitting';

  return {
    state,
    canSubmit,
    showCamera,
    setShowCamera,
    openCamera,
    onSelfieCapture,
    submit,
    reset,
  };
}
