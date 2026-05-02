// ============================================================
// SmartRoll — Signup Screen
// New user registration for students and instructors.
// Students must take a profile selfie for face verification.
// The selfie is uploaded to Supabase Storage after account creation.
// ============================================================

import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/contexts/AuthContext'
import { PASSWORD_RULES, validatePassword, getStrength, STRENGTH_COLORS, STRENGTH_LABELS } from '../../src/utils/passwordRules'
import SelfieCapture from '../../src/components/SelfieCapture'
import { supabase } from '../../src/services/supabase'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const NAVY = '#1a237e'
const MUTED = '#6B6560'
const TEXT = '#1A1714'
const GREEN = '#1A6641'
const DANGER = '#8B1A1A'

/**
 * SignupScreen
 * Renders the account creation form. Validates all fields, calls signUp
 * from AuthContext, then uploads the selfie to Supabase Storage in the
 * background (students only) without blocking the success screen.
 */
export default function SignupScreen() {
  const { signUp } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [role, setRole] = useState<'student' | 'instructor'>('student')
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Field refs for scroll-to-error
  const nameRef = useRef<View>(null)
  const emailRef = useRef<View>(null)
  const idRef = useRef<View>(null)
  const passwordRef = useRef<View>(null)
  const selfieRef = useRef<View>(null)

  // Auto-navigate countdown on success
  useEffect(() => {
    if (!success) return
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          router.replace('/(auth)/login')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [success])

  const strength = getStrength(password)
  const { failed } = validatePassword(password)

  const handleSubmit = async () => {
    setError(null)

    // Scroll to first error field
    const scrollToRef = (ref: React.RefObject<View>) => {
      ref.current?.measureLayout(
        scrollRef.current as any,
        (_x, y) => scrollRef.current?.scrollTo({ y: y - 20, animated: true }),
        () => {}
      )
    }

    if (!fullName.trim()) {
      setError('Enter your full name.')
      scrollToRef(nameRef)
      return
    }
    if (!email.trim()) {
      setError('Enter your email address.')
      scrollToRef(emailRef)
      return
    }
    if (failed.length > 0) {
      setError('Password does not meet all requirements below.')
      scrollToRef(passwordRef)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      scrollToRef(passwordRef)
      return
    }
    if (role === 'student' && !studentId.trim()) {
      setError('Enter your Student ID.')
      scrollToRef(idRef)
      return
    }
    if (role === 'instructor' && !staffId.trim()) {
      setError('Enter your Staff ID.')
      scrollToRef(idRef)
      return
    }
    if (role === 'student' && !selfieBase64) {
      setError('Please take a selfie for identity verification.')
      scrollToRef(selfieRef)
      return
    }

    setSubmitting(true)
    try {
      const idToPass = role === 'student' ? studentId.trim() : staffId.trim()

      // Create Auth user + profile (fast — no delays)
      const result = await signUp(email.trim(), password, fullName.trim(), idToPass, role)
      if (typeof result === 'object' && result.error) { setError(result.error); return }

      // Show success immediately — upload selfie in background for students
      setSuccess(true)

      if (role === 'student' && selfieBase64) {
        // Get user ID from session or sign in
        let userId: string | null = null
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (existingSession?.user?.id) {
          userId = existingSession.user.id
        } else {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: email.trim(), password,
          })
          userId = signInData.session?.user?.id ?? null
        }

        if (userId) {
          // Upload in background — don't block the success screen
          const filePath = `${userId}/profile.jpg`
          const byteArray = Uint8Array.from(atob(selfieBase64), c => c.charCodeAt(0))
          supabase.storage
            .from('face-photos')
            .upload(filePath, byteArray, { contentType: 'image/jpeg', upsert: true })
            .then(({ error: uploadError }) => {
              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('face-photos').getPublicUrl(filePath)
                supabase.from('profiles')
                  .update({ face_photo_url: urlData.publicUrl })
                  .eq('id', userId!)
                  .then(() => {})
              }
            })
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Sign up failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <View style={styles.successIcon}><Text style={{ fontSize: 32 }}>✓</Text></View>
        <Text style={styles.successTitle}>Account Created!</Text>
        <Text style={styles.successSub}>
          {role === 'student'
            ? 'Your student account is ready. You can now log in.'
            : 'Your instructor account is ready. Log in below.'}
        </Text>
        <Text style={styles.successCountdown}>
          Redirecting to login in {countdown}…
        </Text>
        <TouchableOpacity style={[styles.btnPrimary, { width: '100%', marginTop: 16 }]} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.btnPrimaryText}>Go to Login Now</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Create Account</Text>
          <Text style={styles.pageSub}>Join SmartRoll</Text>
        </View>

        <View style={styles.card}>
          {/* Role */}
          <View style={styles.roleRow}>
            {(['student', 'instructor'] as const).map(r => (
              <TouchableOpacity key={r} style={styles.radioOpt} onPress={() => setRole(r)}>
                <View style={[styles.radioDot, role === r && styles.radioDotActive]}>
                  {role === r && <View style={styles.radioDotFill} />}
                </View>
                <Text style={styles.radioLabel}>{r === 'instructor' ? 'Instructor' : 'Student'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <InputField label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" fieldRef={nameRef} />
          <InputField label="Email Address" value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" fieldRef={emailRef} />
          {role === 'student'
            ? <InputField label="Student Reg No" value={studentId} onChangeText={setStudentId} placeholder="SCT211-0001/2024" autoCapitalize="characters" fieldRef={idRef} />
            : <InputField label="Staff ID" value={staffId} onChangeText={setStaffId} placeholder="LEC-001" autoCapitalize="characters" fieldRef={idRef} />
          }

          {/* Password */}
          <View style={styles.inputWrap} ref={passwordRef}>
            <Text style={styles.inputLabel}>Password</Text>
            <View>
              <TextInput style={styles.inputField} placeholder="Create password" placeholderTextColor={MUTED} secureTextEntry={!showPwd} value={password} onChangeText={setPassword} />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(v => !v)}>
                <Text style={styles.eyeText}>{showPwd ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <>
                <View style={styles.strengthRow}>
                  <View style={styles.strengthTrack}><View style={[styles.strengthFill, { width: `${(PASSWORD_RULES.length - failed.length) / PASSWORD_RULES.length * 100}%` as any, backgroundColor: STRENGTH_COLORS[strength] }]} /></View>
                  <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>{STRENGTH_LABELS[strength]}</Text>
                </View>
                {/* Per-rule checklist */}
                <View style={styles.rulesList}>
                  {PASSWORD_RULES.map(rule => {
                    const passed = rule.test(password)
                    return (
                      <View key={rule.id} style={styles.ruleRow}>
                        <Text style={[styles.ruleIcon, { color: passed ? GREEN : MUTED }]}>{passed ? '✓' : '○'}</Text>
                        <Text style={[styles.ruleText, { color: passed ? GREEN : MUTED }]}>{rule.label}</Text>
                      </View>
                    )
                  })}
                </View>
              </>
            )}
          </View>
          <InputField label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" secureTextEntry />

          {/* Selfie — students only */}
          {role === 'student' && (
            <View ref={selfieRef}>
              <View style={styles.selfieInfoBox}>
                <Text style={styles.selfieInfoTitle}>📸 Profile Photo Required</Text>
                <Text style={styles.selfieInfoText}>
                  SmartRoll uses face recognition to verify your identity during attendance. Your selfie is stored securely and only used for attendance checks.
                </Text>
              </View>
              <TouchableOpacity style={[styles.selfieBtn, selfieBase64 && styles.selfieBtnDone]} onPress={() => setShowCamera(true)}>
                {selfieBase64 ? (
                  <View style={styles.selfieRow}>
                    <Image source={{ uri: `data:image/jpeg;base64,${selfieBase64}` }} style={styles.selfiePreview} />
                    <View>
                      <Text style={styles.selfieDone}>✓ Selfie captured</Text>
                      <Text style={styles.selfieRetake}>Tap to retake</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selfiePlaceholder}>Take Profile Selfie (Required)</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.switchText}>Already have an account? <Text style={{ fontWeight: '500' }}>Login</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SelfieCapture visible={showCamera} title="Profile Selfie" subtitle="Face must be clearly visible for attendance verification" onCapture={b64 => { setSelfieBase64(b64); setShowCamera(false) }} onCancel={() => setShowCamera(false)} />
    </KeyboardAvoidingView>
  )
}

/**
 * InputField
 * A labelled text input with floating label styling.
 * @param label - the field label text
 * @param value - the current input value
 * @param onChangeText - change handler
 * @param placeholder - placeholder text
 * @param keyboardType - optional keyboard type
 * @param autoCapitalize - optional auto-capitalise behaviour
 * @param secureTextEntry - if true, masks the input
 */
function InputField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, fieldRef }: any) {
  return (
    <View style={styles.inputWrap} ref={fieldRef}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput style={styles.inputField} placeholder={placeholder} placeholderTextColor={MUTED} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? 'none'} secureTextEntry={secureTextEntry} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingBottom: 0 },
  header: { marginBottom: 24 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 15, color: NAVY },
  pageTitle: { fontSize: 22, fontWeight: '500', color: TEXT, marginBottom: 4 },
  pageSub: { fontSize: 13, color: MUTED },
  card: { backgroundColor: SURFACE, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(26,58,92,0.15)' },
  roleRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 18 },
  radioOpt: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  radioDotActive: { borderWidth: 2 },
  radioDotFill: { width: 8, height: 8, borderRadius: 4, backgroundColor: NAVY },
  radioLabel: { fontSize: 13, color: TEXT },
  inputWrap: { marginBottom: 14, position: 'relative' },
  inputLabel: { position: 'absolute', top: -8, left: 10, zIndex: 1, backgroundColor: SURFACE, paddingHorizontal: 4, fontSize: 10, color: NAVY, fontWeight: '500' },
  inputField: { borderWidth: 1.5, borderColor: NAVY, borderRadius: 10, padding: 12, fontSize: 13, color: TEXT, backgroundColor: SURFACE },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  eyeText: { fontSize: 11, color: NAVY },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthTrack: { flex: 1, height: 3, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 10, fontWeight: '500' },
  selfieBtn: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.13)', borderRadius: 10, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginBottom: 14 },
  selfieBtnDone: { borderStyle: 'solid', borderColor: GREEN, backgroundColor: '#F0FAF4' },
  selfieRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selfiePreview: { width: 44, height: 44, borderRadius: 22 },
  selfieDone: { fontSize: 12, fontWeight: '500', color: GREEN },
  selfieRetake: { fontSize: 10, color: MUTED, marginTop: 2 },
  selfiePlaceholder: { fontSize: 13, color: MUTED },
  errorText: { color: DANGER, fontSize: 12, marginBottom: 10, textAlign: 'center' },
  btnPrimary: { backgroundColor: NAVY, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  switchBtn: { alignItems: 'center', marginTop: 14 },
  switchText: { fontSize: 12, color: MUTED },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '500', color: TEXT, marginBottom: 8 },
  successSub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  successCountdown: { fontSize: 13, color: NAVY, fontWeight: '500', marginTop: 12, marginBottom: 4 },
  rulesList: { marginTop: 8, gap: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleIcon: { fontSize: 12, fontWeight: '700', width: 14 },
  ruleText: { fontSize: 11 },
  selfieInfoBox: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(26,35,126,0.15)' },
  selfieInfoTitle: { fontSize: 12, fontWeight: '600', color: NAVY, marginBottom: 4 },
  selfieInfoText: { fontSize: 11, color: MUTED, lineHeight: 16 },
})
