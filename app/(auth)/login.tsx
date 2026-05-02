// ============================================================
// SmartRoll — Login Screen
// Allows students and instructors to sign in using their
// Student/Staff ID (or email) and password. Supports biometric
// login using stored credentials from a previous session.
// ============================================================

import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Switch, Animated,
} from 'react-native'
import Svg, { Path, Circle, Line } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '../../src/contexts/AuthContext'
import { BiometricService } from '../../src/services/biometric.service'
import { supabase } from '../../src/services/supabase'

// ── Colours (keep existing blue palette) ─────────────────────
const BG       = '#F0F4FF'
const SURFACE  = '#FFFFFF'
const BLUE     = '#1a237e'
const TEXT     = '#1A1714'
const MUTED    = '#9E9E9E'
const BORDER   = '#E0E0E0'
const DANGER   = '#8B1A1A'

const BIOMETRIC_EMAIL_KEY = 'smartroll_bio_email'
const BIOMETRIC_PWD_KEY   = 'smartroll_bio_pwd'

/**
 * Resolves a Student/Staff ID or email to an email address, then signs in.
 * If the input contains '@' it is treated as an email directly.
 * Otherwise, the profiles table is queried for a matching student_id or staff_id.
 *
 * @param signIn - the signIn function from AuthContext
 * @param idOrEmail - the user's Student ID, Staff ID, or email address
 * @param password - the user's password
 * @returns `{ error: string | null }` — null on success
 */
async function resolveEmailAndSignIn(
  signIn: (e: string, p: string) => Promise<{ error: string | null }>,
  idOrEmail: string,
  password: string,
) {
  const trimmed = idOrEmail.trim()

  // If it looks like an email, sign in directly
  if (trimmed.includes('@')) {
    return await signIn(trimmed.toLowerCase(), password)
  }

  // Look up student_id and staff_id case-insensitively in parallel
  const [studentRes, staffRes] = await Promise.all([
    supabase.from('profiles').select('email').ilike('student_id', trimmed).maybeSingle(),
    supabase.from('profiles').select('email').ilike('staff_id', trimmed).maybeSingle(),
  ])

  const email = studentRes.data?.email ?? staffRes.data?.email
  if (email) return await signIn(email.toLowerCase(), password)

  return { error: 'No account found with that ID. Please check and try again.' }
}

/**
 * EyeIcon
 * Toggles between an eye-open and eye-closed SVG icon for password visibility.
 * @param off - if true, renders the eye-closed (password hidden) variant
 */
function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  ) : (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

/**
 * LoginScreen
 * Renders the sign-in form with Student/Staff ID, password, remember-me
 * toggle, forgot-password link, and biometric login button.
 */
export default function LoginScreen() {
  const { signIn } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [idOrEmail, setIdOrEmail]   = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [remember, setRemember]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Shake animation for failed login
  const shakeAnim = useRef(new Animated.Value(0)).current

  function triggerShake() {
    shakeAnim.setValue(0)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  // Caps Lock warning: all-caps input that isn't an email
  const capsLockWarning = idOrEmail.length > 0
    && !idOrEmail.includes('@')
    && idOrEmail === idOrEmail.toUpperCase()
    && /[A-Z]/.test(idOrEmail)

  /**
   * Validates inputs, calls resolveEmailAndSignIn, and stores credentials
   * in SecureStore if the "Remember me" toggle is enabled.
   */
  const handleLogin = async () => {
    setError(null)
    if (!idOrEmail.trim() || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    try {
      const result = await resolveEmailAndSignIn(signIn, idOrEmail, password)
      if (result.error) {
        setError(result.error)
        triggerShake()
      } else if (remember) {
        await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, idOrEmail.trim())
        await SecureStore.setItemAsync(BIOMETRIC_PWD_KEY, password)
      }
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  /**
   * Triggers biometric authentication and signs in using credentials
   * previously saved to SecureStore via the "Remember me" toggle.
   */
  const handleBiometric = async () => {
    const available = await BiometricService.isAvailable()
    if (!available) { Alert.alert('Not available', 'Biometric auth is not set up on this device.'); return }
    const ok = await BiometricService.authenticate('Log in to SmartRoll')
    if (!ok) return
    try {
      const savedId  = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY)
      const savedPwd = await SecureStore.getItemAsync(BIOMETRIC_PWD_KEY)
      if (!savedId || !savedPwd) { Alert.alert('No saved credentials', 'Please log in with your password first.'); return }
      setLoading(true)
      await resolveEmailAndSignIn(signIn, savedId, savedPwd)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Logo — Graduation student icon */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Svg width={56} height={56} viewBox="0 0 64 64" fill="none">
              {/* Graduation cap */}
              <Path d="M32 8 L56 20 L32 32 L8 20 Z" fill={BLUE} />
              <Path d="M48 24 L48 38 C48 38 40 44 32 44 C24 44 16 38 16 38 L16 24" stroke={BLUE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Tassel string */}
              <Line x1="56" y1="20" x2="56" y2="34" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" />
              <Path d="M53 34 Q56 38 59 34" stroke={BLUE} strokeWidth="2" fill="none" strokeLinecap="round" />
              {/* Student body */}
              <Circle cx="32" cy="52" r="6" fill={BLUE} opacity="0.15" />
              <Path d="M20 64 Q20 54 32 54 Q44 54 44 64" fill={BLUE} opacity="0.15" />
              {/* Head */}
              <Circle cx="32" cy="38" r="5" fill={BLUE} opacity="0.3" />
            </Svg>
          </View>
          <Text style={styles.appName}>SmartRoll</Text>
        </View>

        {/* Welcome heading */}
        <Text style={styles.heading}>Hi, welcome back</Text>
        <Text style={styles.subheading}>Sign in with your Student or Staff ID</Text>

        {/* Card */}
        <View style={styles.card}>

          {/* Username */}
          <Text style={styles.fieldLabel}>Student / Staff ID</Text>
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <TextInput
              style={styles.input}
              placeholder="e.g. SCT211-0001/2024 or LEC-001"
              placeholderTextColor={MUTED}
              value={idOrEmail}
              onChangeText={t => { setIdOrEmail(t); setError(null) }}
              autoCapitalize="characters"
              keyboardType="default"
              returnKeyType="next"
              accessibilityLabel="Student or Staff ID"
            />
          </Animated.View>
          {capsLockWarning && (
            <Text style={styles.capsWarning}>⚠ Caps Lock is on — your ID will be entered in uppercase</Text>
          )}

          {/* Password */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Password</Text>
          <View style={styles.pwdRow}>
            <TextInput
              style={styles.pwdInput}
              placeholder="Enter your Password"
              placeholderTextColor={MUTED}
              secureTextEntry={!showPwd}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Password"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(v => !v)} accessibilityRole="button">
              <EyeIcon off={!showPwd} />
            </TouchableOpacity>
          </View>

          {/* Remember me + Forgot */}
          <View style={styles.rememberRow}>
            <TouchableOpacity
              style={styles.rememberLeft}
              onPress={() => setRemember(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                {remember && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} accessibilityRole="button">
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {!!error && (
            <TouchableOpacity
              style={styles.errorBox}
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
              accessibilityHint="Tap to clear this error message"
            >
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          )}

          {/* Sign In button */}
          <TouchableOpacity style={styles.signInBtn} onPress={handleLogin} disabled={loading} accessibilityRole="button">
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.signInText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* Biometric */}
          <View style={styles.biometricSection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric} accessibilityRole="button" accessibilityLabel="Sign in with biometrics">
                {/* Fingerprint SVG icon */}
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                  <Path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                  <Path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                  <Path d="M2 12a10 10 0 0 1 18-6" />
                  <Path d="M2 17.5c0 0 2.5 2.5 6 0" />
                  <Path d="M20 12c0 2-.5 4-2 5.5" />
                  <Path d="M6 10a6 6 0 0 1 11.8-1.5" />
                  <Path d="M9 16.5c.11.66.22 1.34.3 2" />
                </Svg>
                <Text style={styles.biometricTitle}>Biometric Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sign Up link */}
        <View style={styles.signUpRow}>
          <Text style={styles.signUpPrompt}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} accessibilityRole="button">
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 0 },

  // Logo
  logoWrap:  { alignItems: 'center', marginBottom: 20 },
  logoBadge: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: SURFACE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(26,35,126,0.1)',
    marginBottom: 10,
  },
  appName: { fontSize: 18, fontWeight: '800', color: BLUE, letterSpacing: 0.5 },
  logoEmoji: { fontSize: 36 },

  // Heading
  heading:    { fontSize: 28, fontWeight: '800', color: BLUE, textAlign: 'center', marginBottom: 6 },
  subheading: { fontSize: 14, fontWeight: '600', color: TEXT, textAlign: 'center', marginBottom: 28 },

  // Card
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },

  fieldLabel: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 8 },

  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: TEXT,
    backgroundColor: SURFACE,
  },

  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 8,
    backgroundColor: SURFACE,
  },
  pwdInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: TEXT,
  },
  eyeBtn: { paddingHorizontal: 14 },

  // Remember me
  rememberRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 3,
    borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: BLUE, borderColor: BLUE },
  checkmark:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  rememberText: { fontSize: 13, color: TEXT, fontWeight: '500' },
  forgotText:   { fontSize: 13, color: BLUE, fontWeight: '700' },

  capsWarning: { fontSize: 11, color: '#7A4A00', backgroundColor: '#FDF3E0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4, marginBottom: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(139,26,26,0.2)' },
  errorText: { color: DANGER, fontSize: 12, flex: 1 },
  errorDismiss: { color: DANGER, fontSize: 14, fontWeight: '700', marginLeft: 8 },

  // Sign In button
  signInBtn: {
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  // Biometric
  biometricSection: { marginTop: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontSize: 12, color: MUTED, fontWeight: '500' },

  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  biometricTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Sign Up
  signUpRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signUpPrompt: { fontSize: 14, fontWeight: '700', color: TEXT },
  signUpLink:   { fontSize: 14, fontWeight: '700', color: BLUE },
})
