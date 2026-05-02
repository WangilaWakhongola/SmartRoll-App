// Feature: student-attendance-flow
import React, { useEffect } from 'react'
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAttendanceFlow } from '../../hooks/useAttendanceFlow'
import { useLocation } from '../../hooks/useLocation'
import { SessionItem } from '../../hooks/useStudentSessions'
import { NotificationService } from '../../services/notification.service'
import SelfieCapture from '../SelfieCapture'
import { GPSRing } from './GPSRing'
import { StepIndicator } from './StepIndicator'
import { useAuth } from '../../contexts/AuthContext'

// ── Colour constants ──────────────────────────────────────────
const BG = '#E8EEFF'
const SURFACE = '#FFFFFF'
const NAVY = '#1A237E'
const MUTED = '#6B6560'
const TEXT = '#1A1714'
const GREEN = '#1A6641'
const DANGER = '#8B1A1A'
const BORDER2 = 'rgba(0,0,0,0.08)'

// ── Props ─────────────────────────────────────────────────────
export interface AttendanceModalProps {
  visible: boolean
  session: SessionItem | null
  onClose: () => void
  onSuccess: () => void
}

// ── GPS status label helper (pure — exported for testing) ─────
export function getGpsStatusLabel(
  coords: { latitude: number; longitude: number; accuracy: number | null } | null,
  gpsOk: boolean,
  distanceM: number | null,
): { text: string; color: string } {
  if (coords === null) {
    return { text: 'Getting location…', color: '#6B6560' }
  }
  const d = distanceM !== null ? Math.round(distanceM) : 0
  if (gpsOk) {
    return { text: `Inside classroom (${d}m)`, color: '#1A6641' }
  }
  return { text: `Outside geofence (${d}m away)`, color: '#8B1A1A' }
}

// ── AttendanceModal ───────────────────────────────────────────
export function AttendanceModal({
  visible,
  session,
  onClose,
  onSuccess,
}: AttendanceModalProps) {
  const { user } = useAuth()
  const { coords } = useLocation()

  const {
    state,
    canSubmit,
    showCamera,
    setShowCamera,
    onSelfieCapture,
    submit,
    reset,
  } = useAttendanceFlow(
    session,
    coords,
    user?.id ?? '',
    user?.facePhotoUrl,
  )

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      reset()
    }
  }, [visible])

  // Trigger notification when step transitions to 'done'
  useEffect(() => {
    if (state.step === 'done' && session) {
      NotificationService.notifyAttendanceSigned(session.name).catch(() => {})
      onSuccess()
    }
  }, [state.step])

  if (!session) return null

  const { text: labelText, color: labelColor } = getGpsStatusLabel(
    coords,
    state.gpsOk,
    state.distanceM,
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <Text style={styles.title}>{session.name}</Text>
          <Text style={styles.sub}>
            {session.code} · {session.room}
          </Text>

          {/* GPS ring + status label */}
          <View style={styles.gpsArea}>
            <GPSRing inside={state.gpsOk} />
            <Text style={[styles.gpsStatus, { color: labelColor }]}>
              {labelText}
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.steps}>
            <StepIndicator
              gpsOk={state.gpsOk}
              selfieOk={state.selfieOk}
              biometricDone={state.step === 'done'}
              currentStep={state.step}
              onTakeSelfie={() => setShowCamera(true)}
              onRetakeSelfie={() => setShowCamera(true)}
            />
          </View>

          {/* Error message */}
          {!!state.error && (
            <Text style={styles.error}>{state.error}</Text>
          )}

          {/* Action area */}
          {state.step === 'submitting' ? (
            <ActivityIndicator
              color={NAVY}
              size="large"
              style={{ marginTop: 12 }}
            />
          ) : state.step === 'done' ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✓ Attendance Signed!</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.signBtn, !canSubmit && styles.signBtnDisabled]}
              onPress={submit}
              disabled={!canSubmit}
            >
              <Text style={styles.signBtnText}>Sign Attendance</Text>
            </TouchableOpacity>
          )}

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selfie capture modal */}
      <SelfieCapture
        visible={showCamera}
        title="Identity Selfie"
        subtitle="Face the camera clearly for verification"
        onCapture={onSelfieCapture}
        onCancel={() => setShowCamera(false)}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: BORDER2,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: TEXT,
  },
  sub: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 18,
  },
  gpsArea: {
    alignItems: 'center',
    marginBottom: 12,
  },
  gpsStatus: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  steps: {
    marginVertical: 16,
  },
  error: {
    color: DANGER,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  signBtn: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  signBtnDisabled: {
    opacity: 0.45,
  },
  signBtnText: {
    color: SURFACE,
    fontSize: 15,
    fontWeight: '500',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: MUTED,
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#E8F5EE',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  successText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '500',
  },
})

export default AttendanceModal
