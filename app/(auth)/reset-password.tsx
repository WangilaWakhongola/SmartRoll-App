// ============================================================
// SmartRoll — Reset Password Screen
// Allows a user arriving via a password-reset email link to
// set a new password. Validates strength rules, then calls
// supabase.auth.updateUser to persist the change.
// ============================================================

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '../../src/services/supabase'
import { PASSWORD_RULES, validatePassword, getStrength, STRENGTH_COLORS, STRENGTH_LABELS } from '../../src/utils/passwordRules'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const SURFACE2 = '#F0EDE8'
const BORDER = 'rgba(0,0,0,0.08)'
const BORDER2 = 'rgba(0,0,0,0.13)'
const TEXT = '#1A1714'
const MUTED = '#7A7268'
const ACCENT = '#1a237e'
const DANGER = '#8B1A1A'
const GREEN = '#1A6641'

/** Lock icon rendered via SVG */
function LockIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
}

/** Eye-open icon for password visibility toggle */
function ShowIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

/** Eye-closed icon for password visibility toggle */
function HideIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Path d="M1 1l22 22" />
    </Svg>
  )
}

/** Animated check icon shown on success */
function CheckIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Path d="M22 4L12 14.01l-3-3" />
    </Svg>
  )
}

/**
 * ResetPasswordScreen
 * Renders a form for the user to enter and confirm a new password.
 * Validates password strength rules before calling Supabase to update.
 * Shows a success state with a "Sign In Now" CTA after a successful reset.
 */
export default function ResetPasswordScreen() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validates the new password against strength rules, checks confirmation
   * match, then calls supabase.auth.updateUser to persist the new password.
   */
  async function handleReset() {
    setError(null)
    if (!password) { setError('Please enter a new password.'); return }

    // Validate password strength — validatePassword returns { valid, failed }
    const { failed } = validatePassword(password)
    if (failed.length > 0) { setError('Password does not meet requirements.'); return }

    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setSubmitting(true)
    try {
      // Update the authenticated user's password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ─────────────────────────────────────────────
  if (done) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />
        <View style={styles.successIconWrap}>
          <CheckIcon />
        </View>
        <Text style={styles.successTitle}>Password Updated</Text>
        <Text style={styles.successText}>
          Your password has been reset successfully. You can now sign in with your new password.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Sign In Now</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App name header */}
        <View style={styles.topBar}>
          <Text style={styles.appName}>SmartRoll</Text>
        </View>

        <View style={styles.card}>
          {/* Lock icon */}
          <View style={styles.iconWrap}>
            <LockIcon />
          </View>

          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>
            Choose a strong password that you have not used before.
          </Text>

          {/* New password input */}
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 chars, uppercase, number, symbol"
              placeholderTextColor={MUTED}
              value={password}
              onChangeText={t => { setPassword(t); setError(null) }}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              editable={!submitting}
              accessibilityLabel="New password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              style={styles.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <HideIcon /> : <ShowIcon />}
            </TouchableOpacity>
          </View>

          {/* Strength bar + rules checklist — shown once user starts typing */}
          {password.length > 0 && (() => {
            const strength = getStrength(password)
            return (
              <View style={styles.rulesWrap}>
                {/* Segmented strength bar */}
                <View style={styles.strengthRow}>
                  <View style={styles.strengthTrack}>
                    {(['weak','fair','strong','very-strong'] as const).map((level, i) => (
                      <View key={level} style={[styles.strengthSegment, { backgroundColor: (['weak','fair','strong','very-strong'].indexOf(strength) >= i) ? STRENGTH_COLORS[strength] : '#E8E4DE' }]} />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>{STRENGTH_LABELS[strength]}</Text>
                </View>
                {/* Individual rule checklist */}
                {PASSWORD_RULES.map(rule => {
                  const passed = rule.test(password)
                  return (
                    <View key={rule.id} style={styles.ruleRow}>
                      <View style={[styles.ruleDot, { backgroundColor: passed ? GREEN : '#D0C8C0' }]} />
                      <Text style={[styles.ruleText, { color: passed ? GREEN : MUTED }]}>{rule.label}</Text>
                    </View>
                  )
                })}
              </View>
            )
          })()}

          {/* Confirm password input */}
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor={MUTED}
              value={confirmPassword}
              onChangeText={t => { setConfirmPassword(t); setError(null) }}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              editable={!submitting}
              accessibilityLabel="Confirm new password"
            />
          </View>

          {/* Inline error message */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={handleReset}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Reset password"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Reset Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  topBar: { paddingTop: 56, paddingBottom: 24 },
  appName: { fontSize: 20, fontWeight: '700', color: ACCENT, letterSpacing: 0.5 },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER2,
  },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: SURFACE2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    alignSelf: 'center',
  },

  title: { fontSize: 24, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: MUTED, lineHeight: 22, textAlign: 'center', marginBottom: 28 },

  label: { fontSize: 12, fontWeight: '600', color: MUTED, letterSpacing: 0.5, marginBottom: 8 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE2,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    minHeight: 52,
    borderWidth: 1,
    borderColor: BORDER,
  },
  input: { flex: 1, fontSize: 15, color: TEXT, paddingVertical: 14 },
  eyeBtn: { padding: 6 },

  rulesWrap: { backgroundColor: SURFACE2, borderRadius: 12, padding: 14, marginBottom: 16, marginTop: -8 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  strengthTrack: { flex: 1, flexDirection: 'row', gap: 3 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  ruleDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  ruleText: { fontSize: 12 },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,26,26,0.2)',
  },
  errorText: { color: DANGER, fontSize: 13 },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: { fontSize: 24, fontWeight: '700', color: TEXT, marginBottom: 12, textAlign: 'center' },
  successText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
})
