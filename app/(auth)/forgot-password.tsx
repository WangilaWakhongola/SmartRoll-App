// ============================================================
// SmartRoll — Forgot Password Screen
// Allows users to request a password reset email. Validates the
// email address, calls supabase.auth.resetPasswordForEmail, and
// shows a success state with instructions to check their inbox.
// ============================================================

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Path, Circle, Polyline } from 'react-native-svg'
import { supabase } from '../../src/services/supabase'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const SURFACE2 = '#F0EDE8'
const BORDER2 = 'rgba(0,0,0,0.13)'
const TEXT = '#1A1714'
const MUTED = '#7A7268'
const MUTED2 = '#B0A99F'
const ACCENT = '#1a237e'
const RED = '#8B1A1A'
const GREEN = '#1A6641'

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

function MailIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Polyline points="22,6 12,13 2,6" />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Path d="M22 4L12 14.01l-3-3" />
    </Svg>
  )
}

/**
 * ForgotPasswordScreen
 * Renders an email input form. On submit, sends a password reset link
 * via Supabase Auth. Transitions to a success state showing the email
 * address the link was sent to.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validates the email address and sends a password reset link via Supabase Auth.
   * The reset link deep-links back to smartroll://reset-password.
   */
  async function handleSendReset() {
    if (!email.trim()) { setError('Please enter your email address.'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) { setError('Please enter a valid email address.'); return }

    setError(null)
    setSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'smartroll://reset-password',
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Success state
  if (sent) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />
        <View style={styles.successIconWrap}>
          <CheckIcon />
        </View>
        <Text style={styles.successTitle}>Check your email</Text>
        <Text style={styles.successText}>
          We sent a password reset link to{'\n'}
          <Text style={styles.successEmail}>{email.trim()}</Text>
        </Text>
        <Text style={styles.successHint}>
          Click the link in the email to set a new password. Check your spam folder if you don't see it.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Back to Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.resendBtn}
          onPress={() => { setSent(false); setEmail('') }}
          accessibilityRole="button"
        >
          <Text style={styles.resendText}>Resend email</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={ACCENT} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Navy top — same as login */}
        <View style={styles.loginTop}>
          <View style={styles.loginRing} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.eyebrow}>Password Recovery</Text>
          <Text style={styles.loginTitle}>
            Smart<Text style={styles.loginTitleFade}>Roll</Text>
          </Text>
          <Text style={styles.loginSub}>We will send a reset link to your email</Text>
        </View>

        {/* Beige form */}
        <View style={styles.loginForm}>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <MailIcon />
          </View>

          <Text style={styles.formTitle}>Forgot Password?</Text>
          <Text style={styles.formSubtitle}>
            Enter your email address and we will send you a link to reset your password.
          </Text>

          {/* Email */}
          <Text style={styles.formLabel}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.formInput}
            placeholder="your@email.com"
            placeholderTextColor={MUTED2}
            value={email}
            onChangeText={t => { setEmail(t); setError(null) }}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            editable={!submitting}
            accessibilityLabel="Email address"
            returnKeyType="send"
            onSubmitEditing={handleSendReset}
          />

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Send button */}
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={handleSendReset}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            }
          </TouchableOpacity>

          {/* Back to login */}
          <View style={styles.backRow}>
            <Text style={styles.backPrompt}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
              <Text style={styles.backLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ACCENT },
  scroll: { flexGrow: 1 },

  loginTop: {
    backgroundColor: ACCENT,
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 32,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 240,
    justifyContent: 'flex-end',
  },
  loginRing: {
    position: 'absolute', right: -60, top: -60,
    width: 280, height: 280, borderRadius: 140,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { position: 'absolute', top: 56, left: 32, padding: 4 },
  eyebrow: { fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', marginBottom: 12 },
  loginTitle: { fontSize: 36, fontWeight: '700', color: '#fff', lineHeight: 40, marginBottom: 8 },
  loginTitleFade: { color: 'rgba(255,255,255,0.45)' },
  loginSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 22 },

  loginForm: {
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
  },

  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: SURFACE2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, alignSelf: 'center',
  },

  formTitle: { fontSize: 22, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  formSubtitle: { fontSize: 14, color: MUTED, lineHeight: 22, textAlign: 'center', marginBottom: 28 },

  formLabel: { fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 8 },
  formInput: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2,
    borderRadius: 10, color: TEXT, fontSize: 15, padding: 14, marginBottom: 18,
  },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(139,26,26,0.2)',
  },
  errorText: { color: RED, fontSize: 13 },

  primaryBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },

  backRow: { flexDirection: 'row', justifyContent: 'center' },
  backPrompt: { fontSize: 13, color: MUTED },
  backLink: { fontSize: 13, fontWeight: '600', color: ACCENT },

  // Success
  successContainer: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIconWrap: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: '700', color: TEXT, marginBottom: 12, textAlign: 'center' },
  successText: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 24, marginBottom: 8 },
  successEmail: { fontWeight: '700', color: ACCENT },
  successHint: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  resendBtn: { marginTop: 12, padding: 8 },
  resendText: { fontSize: 14, color: ACCENT, fontWeight: '600' },
})
