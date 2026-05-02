// Feature: student-attendance-flow
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { FlowStep } from '../../hooks/useAttendanceFlow'

// ── Colour constants ──────────────────────────────────────────
const GREEN = '#1A6641'
const NAVY = '#1A237E'
const MUTED = '#6B6560'
const TEXT = '#1A1714'
const SURFACE2 = '#E8EDF8'
const BORDER2 = 'rgba(0,0,0,0.08)'

// ── Props ─────────────────────────────────────────────────────
export interface StepIndicatorProps {
  gpsOk: boolean
  selfieOk: boolean
  biometricDone: boolean
  currentStep: FlowStep
  selfieScore?: number
  onTakeSelfie: () => void
  onRetakeSelfie: () => void
}

// ── StepRow ───────────────────────────────────────────────────
interface StepRowProps {
  label: string
  value: string
  done: boolean
  active: boolean
  children?: React.ReactNode
}

function StepRow({ label, value, done, active, children }: StepRowProps) {
  return (
    <View style={stepStyles.row}>
      <View
        style={[
          stepStyles.dot,
          done && stepStyles.dotDone,
          active && !done && stepStyles.dotActive,
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text style={stepStyles.label}>{label}</Text>
        <Text style={[stepStyles.value, done && { color: GREEN }]}>{value}</Text>
        {children}
      </View>
    </View>
  )
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BORDER2,
    marginTop: 4,
    flexShrink: 0,
  },
  dotDone: { backgroundColor: GREEN },
  dotActive: { backgroundColor: NAVY },
  label: {
    fontSize: 9,
    color: MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: { fontSize: 12, color: TEXT, fontWeight: '500' },
})

// ── StepIndicator ─────────────────────────────────────────────
export function StepIndicator({
  gpsOk,
  selfieOk,
  biometricDone,
  currentStep,
  onTakeSelfie,
  onRetakeSelfie,
}: StepIndicatorProps) {
  // ── Step 1: GPS ───────────────────────────────────────────
  const gpsDone = gpsOk
  const gpsActive = !gpsOk && currentStep === 'gps'
  const gpsValue = gpsDone
    ? 'Verified inside classroom'
    : 'Waiting for GPS...'

  // ── Step 2: Selfie ────────────────────────────────────────
  const selfieDone = selfieOk
  const selfieActive = gpsOk && !selfieOk && currentStep === 'selfie'
  const selfieValue = selfieDone
    ? 'Face matched ✓'
    : 'Take a selfie to verify identity'

  // ── Step 3: Biometric ─────────────────────────────────────
  const biometricActive =
    selfieOk && !biometricDone && currentStep === 'biometric'
  const biometricValue = biometricDone
    ? 'Confirmed ✓'
    : 'Fingerprint / Face ID on sign'

  return (
    <View>
      {/* Step 1 — GPS */}
      <StepRow
        label="GPS Location"
        value={gpsValue}
        done={gpsDone}
        active={gpsActive}
      />

      {/* Step 2 — Selfie */}
      <StepRow
        label="Identity Selfie"
        value={selfieValue}
        done={selfieDone}
        active={selfieActive}
      >
        {/* "Take Selfie" button: only when selfie step is active and not yet done */}
        {currentStep === 'selfie' && !selfieOk && (
          <TouchableOpacity
            style={selfieStyles.selfieBtn}
            onPress={onTakeSelfie}
          >
            <Text style={selfieStyles.selfieBtnText}>📷  Take Selfie</Text>
          </TouchableOpacity>
        )}

        {/* "Retake" button: whenever selfie is already done */}
        {selfieOk && (
          <TouchableOpacity
            style={[selfieStyles.selfieBtn, selfieStyles.selfieBtnDone]}
            onPress={onRetakeSelfie}
          >
            <Text style={[selfieStyles.selfieBtnText, { color: GREEN }]}>
              ✓ Face Matched — Retake
            </Text>
          </TouchableOpacity>
        )}
      </StepRow>

      {/* Step 3 — Biometric */}
      <StepRow
        label="Biometric"
        value={biometricValue}
        done={biometricDone}
        active={biometricActive}
      />
    </View>
  )
}

const selfieStyles = StyleSheet.create({
  selfieBtn: {
    marginTop: 6,
    backgroundColor: SURFACE2,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  selfieBtnDone: {
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: GREEN,
  },
  selfieBtnText: { fontSize: 12, color: NAVY, fontWeight: '500' },
})

export default StepIndicator
